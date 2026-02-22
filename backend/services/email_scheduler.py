"""
Email Scheduler Service - Background task for processing email queue
and scheduling time-based emails (E7-E10 webinar reminders)
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from database import db

logger = logging.getLogger(__name__)


def subtract_business_hours(target_datetime: datetime, hours: int) -> datetime:
    """
    Subtract business hours from a datetime, excluding weekends.
    Business hours count all hours of weekdays (Monday-Friday).
    
    Example: If webinar is Monday 10:00, 24 business hours before = Friday 10:00
    """
    current = target_datetime
    remaining = hours
    
    while remaining > 0:
        current -= timedelta(hours=1)
        # Only count if it's a weekday (0=Monday, 4=Friday)
        if current.weekday() < 5:
            remaining -= 1
    
    return current


def subtract_natural_days(target_datetime: datetime, days: int) -> datetime:
    """Subtract natural (calendar) days from a datetime"""
    return target_datetime - timedelta(days=days)


class EmailSchedulerService:
    """Service for scheduling webinar reminder emails"""
    
    def __init__(self):
        self._running = False
        self._task = None
    
    async def schedule_webinar_reminders(self, event_id: str) -> Dict[str, int]:
        """
        Schedule all reminder emails (E7-E10) for a webinar event.
        Should be called when registrants are imported to an event.
        
        Returns count of emails scheduled per rule.
        """
        from services.email_queue import email_queue
        
        # Get event details
        event = await db.webinar_events_v2.find_one({"id": event_id}, {"_id": 0})
        if not event:
            logger.error(f"Event not found: {event_id}")
            return {}
        
        event_name = event.get("name", "Webinar")
        event_date_str = event.get("webinar_date", "")
        event_time_str = event.get("webinar_time", "10:00")
        watching_room_url = event.get("watching_room_url", f"https://leaderlix.com/nurture/lms/webinar/{event_id}")
        
        # Parse event datetime
        try:
            event_datetime = datetime.fromisoformat(f"{event_date_str}T{event_time_str}:00")
            # Assume Mexico City timezone if not specified
            if event_datetime.tzinfo is None:
                event_datetime = event_datetime.replace(tzinfo=timezone(timedelta(hours=-6)))
        except Exception as e:
            logger.error(f"Error parsing event datetime: {e}")
            return {}
        
        # Get all registered contacts for this event
        contacts = await db.unified_contacts.find({
            "webinar_history": {"$elemMatch": {"event_id": event_id, "status": "registered"}}
        }, {"_id": 0, "id": 1, "email": 1, "emails": 1, "name": 1, "first_name": 1}).to_list(10000)
        
        results = {"E7": 0, "E8": 0, "E9": 0, "E10": 0}
        now = datetime.now(timezone.utc)
        
        for contact in contacts:
            contact_id = contact.get("id")
            contact_email = contact.get("email") or (contact.get("emails", [{}])[0].get("email") if contact.get("emails") else None)
            contact_name = contact.get("name") or contact.get("first_name") or "Participante"
            
            if not contact_email:
                continue
            
            # Check if already scheduled for each rule
            existing = await db.email_queue.find({
                "contact_id": contact_id,
                "metadata.webinar_id": event_id,
                "rule": {"$in": ["E7", "E8", "E9", "E10"]},
                "status": {"$in": ["pending", "sent"]}
            }, {"_id": 0, "rule": 1}).to_list(10)
            
            existing_rules = {e["rule"] for e in existing}
            
            # E7: At exact time of webinar
            if "E7" not in existing_rules and event_datetime > now:
                await email_queue.add_to_queue(
                    rule="E7",
                    contact_id=contact_id,
                    contact_email=contact_email,
                    contact_name=contact_name,
                    subject=f"🔴 ¡{event_name} comienza AHORA!",
                    body_html=self._get_reminder_template("E7", event_name, watching_room_url, contact_name),
                    scheduled_at=event_datetime,
                    metadata={"webinar_id": event_id, "event_name": event_name}
                )
                results["E7"] += 1
            
            # E8: 1 hour before
            e8_time = event_datetime - timedelta(hours=1)
            if "E8" not in existing_rules and e8_time > now:
                await email_queue.add_to_queue(
                    rule="E8",
                    contact_id=contact_id,
                    contact_email=contact_email,
                    contact_name=contact_name,
                    subject=f"⏰ {event_name} comienza en 1 hora",
                    body_html=self._get_reminder_template("E8", event_name, watching_room_url, contact_name),
                    scheduled_at=e8_time,
                    metadata={"webinar_id": event_id, "event_name": event_name}
                )
                results["E8"] += 1
            
            # E9: 24 business hours before
            e9_time = subtract_business_hours(event_datetime, 24)
            if "E9" not in existing_rules and e9_time > now:
                await email_queue.add_to_queue(
                    rule="E9",
                    contact_id=contact_id,
                    contact_email=contact_email,
                    contact_name=contact_name,
                    subject=f"📅 Mañana: {event_name}",
                    body_html=self._get_reminder_template("E9", event_name, watching_room_url, contact_name, event_datetime),
                    scheduled_at=e9_time,
                    metadata={"webinar_id": event_id, "event_name": event_name}
                )
                results["E9"] += 1
            
            # E10: 7 natural days before
            e10_time = subtract_natural_days(event_datetime, 7)
            if "E10" not in existing_rules and e10_time > now:
                await email_queue.add_to_queue(
                    rule="E10",
                    contact_id=contact_id,
                    contact_email=contact_email,
                    contact_name=contact_name,
                    subject=f"🗓️ En 7 días: {event_name}",
                    body_html=self._get_reminder_template("E10", event_name, watching_room_url, contact_name, event_datetime),
                    scheduled_at=e10_time,
                    metadata={"webinar_id": event_id, "event_name": event_name}
                )
                results["E10"] += 1
        
        logger.info(f"Scheduled reminders for event {event_id}: {results}")
        return results
    
    async def schedule_e6_confirmations(self) -> int:
        """
        Schedule E6 (pre-registration confirmation) emails for contacts
        who were imported to webinars in the last calendar week.
        
        Returns count of emails scheduled.
        """
        from services.email_queue import email_queue
        
        now = datetime.now(timezone.utc)
        
        # Calculate last calendar week (Monday to Sunday)
        today = now.date()
        days_since_monday = today.weekday()
        last_monday = today - timedelta(days=days_since_monday + 7)
        last_sunday = last_monday + timedelta(days=6)
        
        # Convert to datetime
        week_start = datetime.combine(last_monday, datetime.min.time()).replace(tzinfo=timezone.utc)
        week_end = datetime.combine(last_sunday, datetime.max.time()).replace(tzinfo=timezone.utc)
        
        # Find contacts with webinar registrations in last week
        contacts = await db.unified_contacts.find({
            "webinar_history": {
                "$elemMatch": {
                    "registered_at": {"$gte": week_start.isoformat(), "$lte": week_end.isoformat()},
                    "source": "csv_import"
                }
            }
        }, {"_id": 0}).to_list(10000)
        
        scheduled = 0
        
        for contact in contacts:
            contact_id = contact.get("id")
            contact_email = contact.get("email") or (contact.get("emails", [{}])[0].get("email") if contact.get("emails") else None)
            contact_name = contact.get("name") or contact.get("first_name") or "Participante"
            
            if not contact_email:
                continue
            
            # Get registrations from last week
            webinar_history = contact.get("webinar_history", [])
            e6_sent = contact.get("last_email_e6_sent", {})
            
            for registration in webinar_history:
                reg_date_str = registration.get("registered_at", "")
                event_id = registration.get("event_id")
                event_name = registration.get("event_name", "Webinar")
                
                if not event_id or not reg_date_str:
                    continue
                
                # Check if registered in last week
                try:
                    reg_date = datetime.fromisoformat(reg_date_str.replace('Z', '+00:00'))
                    if not (week_start <= reg_date <= week_end):
                        continue
                except (ValueError, TypeError):
                    continue
                
                # Check if E6 already sent for this webinar
                if event_id in e6_sent:
                    continue
                
                # Check if already queued
                existing = await db.email_queue.find_one({
                    "contact_id": contact_id,
                    "rule": "E6",
                    "metadata.webinar_id": event_id,
                    "status": {"$in": ["pending", "sent"]}
                })
                
                if existing:
                    continue
                
                # Schedule E6
                await email_queue.add_to_queue(
                    rule="E6",
                    contact_id=contact_id,
                    contact_email=contact_email,
                    contact_name=contact_name,
                    subject=f"✅ Tu pre-registro a {event_name} está completo",
                    body_html=self._get_e6_template(contact_name, event_name),
                    scheduled_at=now,  # Send immediately
                    metadata={"webinar_id": event_id, "event_name": event_name}
                )
                scheduled += 1
        
        logger.info(f"Scheduled {scheduled} E6 confirmation emails")
        return scheduled
    
    def _get_reminder_template(
        self, 
        rule: str, 
        event_name: str, 
        watching_room_url: str, 
        contact_name: str,
        event_datetime: datetime = None
    ) -> str:
        """Get HTML template for webinar reminder emails"""
        
        date_str = event_datetime.strftime("%A %d de %B a las %H:%M hrs") if event_datetime else ""
        
        if rule == "E7":
            return f"""
            <p>¡Hola {contact_name.split()[0]}!</p>
            <p><strong>🔴 ¡{event_name} está comenzando AHORA!</strong></p>
            <p>No te lo pierdas. Haz clic aquí para unirte:</p>
            <p style="text-align: center; margin: 30px 0;">
                <a href="{watching_room_url}" style="background: #ff3300; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                    UNIRME AHORA →
                </a>
            </p>
            <p>¡Te esperamos!</p>
            """
        elif rule == "E8":
            return f"""
            <p>¡Hola {contact_name.split()[0]}!</p>
            <p>Este es un recordatorio de que <strong>{event_name}</strong> comienza en <strong>1 hora</strong>.</p>
            <p>Asegúrate de tener todo listo y guarda este link para unirte:</p>
            <p style="text-align: center; margin: 30px 0;">
                <a href="{watching_room_url}" style="background: #ff3300; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                    IR AL WEBINAR →
                </a>
            </p>
            <p>¡Nos vemos pronto!</p>
            """
        elif rule == "E9":
            return f"""
            <p>¡Hola {contact_name.split()[0]}!</p>
            <p>Te recordamos que <strong>mañana</strong> es el día de <strong>{event_name}</strong>.</p>
            <p><strong>📅 {date_str}</strong></p>
            <p>Guarda este link para unirte cuando sea el momento:</p>
            <p style="text-align: center; margin: 30px 0;">
                <a href="{watching_room_url}" style="background: #333; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                    GUARDAR LINK →
                </a>
            </p>
            <p>¡Te esperamos!</p>
            """
        elif rule == "E10":
            return f"""
            <p>¡Hola {contact_name.split()[0]}!</p>
            <p>Queremos recordarte que en <strong>7 días</strong> tenemos un evento importante:</p>
            <p><strong>🗓️ {event_name}</strong></p>
            <p><strong>📅 {date_str}</strong></p>
            <p>Marca tu calendario y prepárate para una sesión de alto impacto.</p>
            <p style="text-align: center; margin: 30px 0;">
                <a href="{watching_room_url}" style="background: #333; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                    AGREGAR A MI CALENDARIO →
                </a>
            </p>
            <p>¡Nos vemos pronto!</p>
            """
        
        return f"<p>Recordatorio: {event_name}</p>"
    
    def _get_e6_template(self, contact_name: str, event_name: str) -> str:
        """Get HTML template for E6 pre-registration confirmation"""
        return f"""
        <p>¡Hola {contact_name.split()[0]}!</p>
        <p>Tu <strong>pre-registro</strong> a <strong>{event_name}</strong> se ha completado con éxito. 🎉</p>
        <p>Para <strong>completar tu registro</strong>, necesitamos que nos confirmes los datos de los participantes.</p>
        <p><strong>Por favor responde este correo con la siguiente información:</strong></p>
        <ul>
            <li>Nombre completo de cada participante</li>
            <li>Correo electrónico de cada participante</li>
            <li>Teléfono de contacto de cada participante</li>
        </ul>
        <p><em>Puedes registrar hasta 10 participantes de tu equipo.</em></p>
        <p>Ejemplo de respuesta:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p style="margin: 5px 0;">1. Juan Pérez - juan@empresa.com - +52 55 1234 5678</p>
            <p style="margin: 5px 0;">2. María García - maria@empresa.com - +52 55 8765 4321</p>
        </div>
        <p>Una vez que recibamos esta información, te enviaremos la confirmación final con los detalles del evento.</p>
        <p>¡Gracias por tu interés!</p>
        """
    
    async def process_queue_task(self):
        """Background task that processes email queue every minute"""
        from services.email_queue import email_queue
        from database import db
        
        while self._running:
            try:
                # Check if auto-send is enabled
                settings = await db.email_settings.find_one({"id": "global"}, {"_id": 0})
                auto_send_enabled = settings.get("auto_send_enabled", False) if settings else False
                
                if auto_send_enabled:
                    results = await email_queue.process_queue()
                    if results["sent"] > 0 or results["failed"] > 0:
                        logger.info(f"Queue processed: {results}")
                else:
                    # Just log that auto-send is disabled
                    pass
            except Exception as e:
                logger.error(f"Error processing queue: {e}")
            
            # Wait 60 seconds before next iteration
            await asyncio.sleep(60)
    
    def start_background_task(self):
        """Start the background queue processor"""
        if self._running:
            return
        
        self._running = True
        self._task = asyncio.create_task(self.process_queue_task())
        logger.info("Email scheduler background task started")
    
    def stop_background_task(self):
        """Stop the background queue processor"""
        self._running = False
        if self._task:
            self._task.cancel()
        logger.info("Email scheduler background task stopped")


# Singleton instance
email_scheduler = EmailSchedulerService()
