"""
Email Queue Service - Manages email queue with rate limiting for Amazon SES
Handles scheduling and batch processing of emails for E1-E10 rules
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).parent.parent / '.env')

import uuid
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from database import db
from services.email_service import email_service

logger = logging.getLogger(__name__)

# Rate limiting: SES allows ~14/second, we'll be conservative
MAX_EMAILS_PER_SECOND = 10
MAX_EMAILS_PER_BATCH = 100

# Sender configuration
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "contact@leaderlix.com")
SENDER_NAME = os.environ.get("SENDER_NAME", "María Gargari")


class EmailQueueService:
    """Service for managing email queue with rate limiting"""
    
    async def add_to_queue(
        self,
        rule: str,
        contact_id: str,
        contact_email: str,
        contact_name: str,
        subject: str,
        body_html: str,
        body_text: str = None,
        scheduled_at: datetime = None,
        metadata: Dict[str, Any] = None
    ) -> str:
        """
        Add an email to the queue
        
        Args:
            rule: Email rule (E1-E10)
            contact_id: Contact UUID
            contact_email: Recipient email
            contact_name: Recipient name
            subject: Email subject
            body_html: HTML body content
            body_text: Plain text body (optional)
            scheduled_at: When to send (default: now)
            metadata: Additional data (webinar_id, etc.)
        
        Returns:
            Queue item ID
        """
        email_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        
        queue_item = {
            "id": email_id,
            "rule": rule,
            "contact_id": contact_id,
            "contact_email": contact_email,
            "contact_name": contact_name,
            "subject": subject,
            "body_html": body_html,
            "body_text": body_text or self._html_to_text(body_html),
            "scheduled_at": (scheduled_at or now).isoformat(),
            "status": "pending",
            "attempts": 0,
            "sent_at": None,
            "error": None,
            "message_id": None,
            "metadata": metadata or {},
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        await db.email_queue.insert_one(queue_item)
        logger.info(f"Email queued: {email_id} for {contact_email} (rule: {rule})")
        
        return email_id
    
    async def add_batch_to_queue(
        self,
        emails: List[Dict[str, Any]]
    ) -> List[str]:
        """Add multiple emails to queue at once"""
        email_ids = []
        now = datetime.now(timezone.utc)
        
        for email_data in emails:
            email_id = str(uuid.uuid4())
            queue_item = {
                "id": email_id,
                "rule": email_data.get("rule", "unknown"),
                "contact_id": email_data.get("contact_id"),
                "contact_email": email_data.get("contact_email"),
                "contact_name": email_data.get("contact_name", ""),
                "subject": email_data.get("subject"),
                "body_html": email_data.get("body_html"),
                "body_text": email_data.get("body_text") or self._html_to_text(email_data.get("body_html", "")),
                "scheduled_at": email_data.get("scheduled_at", now).isoformat() if isinstance(email_data.get("scheduled_at"), datetime) else email_data.get("scheduled_at", now.isoformat()),
                "status": "pending",
                "attempts": 0,
                "sent_at": None,
                "error": None,
                "message_id": None,
                "metadata": email_data.get("metadata", {}),
                "created_at": now.isoformat(),
                "updated_at": now.isoformat()
            }
            email_ids.append(email_id)
            await db.email_queue.insert_one(queue_item)
        
        logger.info(f"Batch queued: {len(email_ids)} emails")
        return email_ids
    
    async def process_queue(self, max_emails: int = MAX_EMAILS_PER_BATCH) -> Dict[str, int]:
        """
        Process pending emails from queue with rate limiting
        
        Returns:
            Dict with sent, failed, and remaining counts
        """
        now = datetime.now(timezone.utc)
        
        # Find pending emails that are due
        pending_emails = await db.email_queue.find({
            "status": "pending",
            "scheduled_at": {"$lte": now.isoformat()},
            "attempts": {"$lt": 3}  # Max 3 attempts
        }).sort("scheduled_at", 1).to_list(max_emails)
        
        results = {"sent": 0, "failed": 0, "remaining": 0}
        
        for i, email_item in enumerate(pending_emails):
            try:
                # Rate limiting: sleep between emails
                if i > 0 and i % MAX_EMAILS_PER_SECOND == 0:
                    await asyncio.sleep(1)
                
                # Send email via SES
                result = await email_service.send_email(
                    to_email=email_item["contact_email"],
                    subject=email_item["subject"],
                    html_content=self._wrap_html_template(
                        email_item["body_html"],
                        email_item["id"]
                    ),
                    plain_content=email_item["body_text"],
                    from_email=SENDER_EMAIL,
                    from_name=SENDER_NAME
                )
                
                if result.get("success"):
                    # Update as sent
                    await db.email_queue.update_one(
                        {"id": email_item["id"]},
                        {"$set": {
                            "status": "sent",
                            "sent_at": datetime.now(timezone.utc).isoformat(),
                            "message_id": result.get("message_id"),
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    
                    # Log to email_logs
                    await self._log_sent_email(email_item, result)
                    
                    # Update contact tracking
                    await self._update_contact_tracking(email_item)
                    
                    results["sent"] += 1
                    logger.info(f"Email sent: {email_item['id']} to {email_item['contact_email']}")
                else:
                    # Mark as failed attempt
                    await db.email_queue.update_one(
                        {"id": email_item["id"]},
                        {
                            "$inc": {"attempts": 1},
                            "$set": {
                                "error": result.get("error"),
                                "updated_at": datetime.now(timezone.utc).isoformat()
                            }
                        }
                    )
                    results["failed"] += 1
                    logger.error(f"Email failed: {email_item['id']} - {result.get('error')}")
                    
            except Exception as e:
                logger.error(f"Error processing email {email_item['id']}: {str(e)}")
                await db.email_queue.update_one(
                    {"id": email_item["id"]},
                    {
                        "$inc": {"attempts": 1},
                        "$set": {
                            "error": str(e),
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                    }
                )
                results["failed"] += 1
        
        # Count remaining
        results["remaining"] = await db.email_queue.count_documents({
            "status": "pending",
            "attempts": {"$lt": 3}
        })
        
        return results
    
    async def get_queue_stats(self) -> Dict[str, Any]:
        """Get current queue statistics"""
        now = datetime.now(timezone.utc)
        
        pending = await db.email_queue.count_documents({"status": "pending"})
        sent_today = await db.email_queue.count_documents({
            "status": "sent",
            "sent_at": {"$gte": now.replace(hour=0, minute=0, second=0).isoformat()}
        })
        failed = await db.email_queue.count_documents({
            "status": "pending",
            "attempts": {"$gte": 3}
        })
        
        # Stats by rule
        pipeline = [
            {"$match": {"status": "sent", "sent_at": {"$gte": now.replace(hour=0, minute=0, second=0).isoformat()}}},
            {"$group": {"_id": "$rule", "count": {"$sum": 1}}}
        ]
        by_rule = await db.email_queue.aggregate(pipeline).to_list(20)
        
        return {
            "pending": pending,
            "sent_today": sent_today,
            "failed": failed,
            "by_rule": {item["_id"]: item["count"] for item in by_rule}
        }
    
    async def cancel_email(self, email_id: str) -> bool:
        """Cancel a pending email"""
        result = await db.email_queue.update_one(
            {"id": email_id, "status": "pending"},
            {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return result.modified_count > 0
    
    async def retry_failed(self, email_id: str) -> bool:
        """Retry a failed email"""
        result = await db.email_queue.update_one(
            {"id": email_id, "attempts": {"$gte": 3}},
            {"$set": {"attempts": 0, "status": "pending", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return result.modified_count > 0
    
    def _html_to_text(self, html: str) -> str:
        """Convert HTML to plain text"""
        import re
        text = html.replace('<br>', '\n').replace('<br/>', '\n').replace('<br />', '\n')
        text = text.replace('<p>', '\n').replace('</p>', '\n')
        text = text.replace('<li>', '\n• ').replace('</li>', '')
        text = re.sub('<[^<]+?>', '', text)
        text = re.sub(r'\n\s*\n', '\n\n', text)
        return text.strip()
    
    def _wrap_html_template(self, body_html: str, email_id: str) -> str:
        """Wrap body in HTML email template with tracking pixel"""
        tracking_url = os.environ.get("REACT_APP_BACKEND_URL", "")
        tracking_pixel = f'<img src="{tracking_url}/api/email-individual/track/open/{email_id}" width="1" height="1" style="display:none" alt="" />' if tracking_url else ""
        
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .signature {{ margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                {body_html}
                <div class="signature">
                    <p>{SENDER_NAME}</p>
                    <p>Equipo Leaderlix</p>
                    <p style="font-size: 12px; color: #999;">
                        <a href="https://leaderlix.com" style="color: #ff3300;">leaderlix.com</a>
                    </p>
                </div>
            </div>
            {tracking_pixel}
        </body>
        </html>
        """
    
    async def _log_sent_email(self, email_item: Dict, result: Dict):
        """Log sent email to email_logs collection"""
        log_entry = {
            "id": str(uuid.uuid4()),
            "queue_id": email_item["id"],
            "rule": email_item["rule"],
            "contact_id": email_item["contact_id"],
            "contact_email": email_item["contact_email"],
            "subject": email_item["subject"],
            "message_id": result.get("message_id"),
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "metadata": email_item.get("metadata", {}),
            "opened": False,
            "clicked": False,
            "replied": False
        }
        await db.email_logs.insert_one(log_entry)
    
    async def _update_contact_tracking(self, email_item: Dict):
        """Update contact's email tracking fields"""
        rule = email_item["rule"]
        contact_id = email_item["contact_id"]
        now = datetime.now(timezone.utc).isoformat()
        metadata = email_item.get("metadata", {})
        
        update_data = {"updated_at": now}
        
        # For webinar-specific rules (E6-E10), track per webinar
        if rule in ["E6", "E7", "E8", "E9", "E10"]:
            webinar_id = metadata.get("webinar_id")
            if webinar_id:
                update_data[f"last_email_{rule.lower()}_sent.{webinar_id}"] = now
        else:
            # For E1-E5, track globally
            update_data[f"last_email_{rule.lower()}_sent"] = now
        
        await db.unified_contacts.update_one(
            {"id": contact_id},
            {"$set": update_data}
        )


# Singleton instance
email_queue = EmailQueueService()
