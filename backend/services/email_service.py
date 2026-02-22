"""
Email Service - Amazon SES integration for Leaderlix
Handles newsletter delivery and certificate emails
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).parent.parent / '.env')

import boto3
from botocore.exceptions import ClientError
from typing import Optional, List
import base64
import logging

logger = logging.getLogger(__name__)

# Get credentials from environment
AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
DEFAULT_SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "contact@leaderlix.com")
DEFAULT_SENDER_NAME = os.environ.get("SENDER_NAME", "Leaderlix")


class EmailService:
    """Service for sending emails via Amazon SES"""
    
    def __init__(self):
        self.sender_email = DEFAULT_SENDER_EMAIL
        self.sender_name = DEFAULT_SENDER_NAME
        self.region = AWS_REGION
        
    def _get_client(self):
        """Get SES client instance"""
        if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY:
            raise ValueError("AWS credentials not configured")
        return boto3.client(
            'ses',
            region_name=self.region,
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY
        )
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        plain_content: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
        attachments: Optional[List[dict]] = None
    ) -> dict:
        """
        Send an email via Amazon SES
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML body content
            plain_content: Plain text fallback (optional)
            from_email: Sender email (optional, uses default)
            from_name: Sender name (optional, uses default)
            attachments: List of attachments (not supported in simple send)
        
        Returns:
            dict with success status and message_id
        """
        try:
            ses = self._get_client()
            
            # Build the email
            source = f"{from_name or self.sender_name} <{from_email or self.sender_email}>"
            
            body = {
                'Html': {
                    'Data': html_content,
                    'Charset': 'UTF-8'
                }
            }
            
            if plain_content:
                body['Text'] = {
                    'Data': plain_content,
                    'Charset': 'UTF-8'
                }
            
            response = ses.send_email(
                Source=source,
                Destination={
                    'ToAddresses': [to_email]
                },
                Message={
                    'Subject': {
                        'Data': subject,
                        'Charset': 'UTF-8'
                    },
                    'Body': body
                }
            )
            
            message_id = response.get('MessageId')
            logger.info(f"Email sent successfully. Message ID: {message_id}")
            
            return {
                "success": True,
                "status_code": 200,
                "message_id": message_id
            }
            
        except ClientError as error:
            error_code = error.response['Error']['Code']
            error_message = error.response['Error']['Message']
            logger.error(f"SES Error {error_code}: {error_message}")
            return {
                "success": False,
                "error": f"{error_code}: {error_message}"
            }
        except Exception as e:
            logger.error(f"Error sending email: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def send_certificate_email(
        self,
        recipient_email: str,
        recipient_name: str,
        certificate_number: str,
        program_name: str,
        level: str,
        pdf_content: bytes
    ) -> dict:
        """Send certificate email with PDF attachment using raw email"""
        
        try:
            import email.mime.multipart
            import email.mime.text
            import email.mime.application
            
            ses = self._get_client()
            
            # Create multipart message
            msg = email.mime.multipart.MIMEMultipart('mixed')
            msg['Subject'] = f"🎓 Tu Certificado {certificate_number} - {program_name}"
            msg['From'] = f"{self.sender_name} <{self.sender_email}>"
            msg['To'] = recipient_email
            
            # HTML body
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body {{ font-family: 'Segoe UI', Arial, sans-serif; background-color: #0a0c10; color: #fff; padding: 40px; }}
                    .container {{ max-width: 600px; margin: 0 auto; background: #111; border-radius: 12px; padding: 40px; }}
                    .header {{ text-align: center; margin-bottom: 30px; }}
                    .logo {{ font-size: 32px; font-weight: bold; color: #ff3300; }}
                    h1 {{ color: #fff; font-size: 24px; margin-bottom: 10px; }}
                    .badge {{ display: inline-block; background: #ff3300; color: #fff; padding: 8px 16px; border-radius: 20px; font-size: 14px; margin: 10px 0; }}
                    .details {{ background: #0a0a0a; border-radius: 8px; padding: 20px; margin: 20px 0; }}
                    .detail-row {{ display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #222; }}
                    .detail-label {{ color: #888; }}
                    .detail-value {{ color: #fff; font-weight: 600; }}
                    .footer {{ text-align: center; margin-top: 40px; color: #666; font-size: 12px; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">LEADERLIX</div>
                        <h1>¡Felicidades, {recipient_name}!</h1>
                        <p style="color: #888;">Has completado exitosamente el programa</p>
                    </div>
                    
                    <div style="text-align: center;">
                        <span class="badge">🎓 Certificado Emitido</span>
                    </div>
                    
                    <div class="details">
                        <div class="detail-row">
                            <span class="detail-label">Programa</span>
                            <span class="detail-value">{program_name}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Nivel</span>
                            <span class="detail-value">{level}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">No. Certificado</span>
                            <span class="detail-value">{certificate_number}</span>
                        </div>
                    </div>
                    
                    <p style="color: #ccc; text-align: center;">
                        Tu certificado está adjunto a este correo en formato PDF.
                        Puedes descargarlo e imprimirlo cuando lo necesites.
                    </p>
                    
                    <div class="footer">
                        <p>© 2025 Leaderlix. Todos los derechos reservados.</p>
                        <p>10601 Clarence Dr., Suite 250, Frisco, TX 75033</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Attach HTML body
            html_part = email.mime.text.MIMEText(html_content, 'html', 'utf-8')
            msg.attach(html_part)
            
            # Attach PDF
            pdf_attachment = email.mime.application.MIMEApplication(pdf_content, 'pdf')
            pdf_attachment.add_header('Content-Disposition', 'attachment', 
                                     filename=f"Certificado_{certificate_number}.pdf")
            msg.attach(pdf_attachment)
            
            # Send raw email
            response = ses.send_raw_email(
                Source=self.sender_email,
                Destinations=[recipient_email],
                RawMessage={'Data': msg.as_string()}
            )
            
            return {
                "success": True,
                "message_id": response.get('MessageId')
            }
            
        except Exception as e:
            logger.error(f"Error sending certificate email: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def send_newsletter(
        self,
        recipients: List[str],
        subject: str,
        html_content: str,
        newsletter_name: str
    ) -> dict:
        """
        Send newsletter to multiple recipients
        """
        results = {
            "total": len(recipients),
            "sent": 0,
            "failed": 0,
            "errors": []
        }
        
        for email_addr in recipients:
            try:
                result = await self.send_email(
                    to_email=email_addr,
                    subject=subject,
                    html_content=html_content
                )
                if result.get("success"):
                    results["sent"] += 1
                else:
                    results["failed"] += 1
                    results["errors"].append({"email": email_addr, "error": result.get("error")})
            except Exception as e:
                results["failed"] += 1
                results["errors"].append({"email": email_addr, "error": str(e)})
        
        return results
    
    async def send_verification_email(
        self,
        to_email: str,
        user_name: str,
        verification_url: str
    ) -> dict:
        """
        Send email verification email to new user
        
        Args:
            to_email: Recipient email address
            user_name: User's name for personalization
            verification_url: Full URL to verify the email
        
        Returns:
            dict with success status
        """
        subject = "Verifica tu cuenta - Leaderlix"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; background-color: #0a0c10; color: #fff; padding: 40px; margin: 0; }}
                .container {{ max-width: 600px; margin: 0 auto; background: #111; border-radius: 12px; padding: 40px; }}
                .header {{ text-align: center; margin-bottom: 30px; }}
                .logo {{ font-size: 32px; font-weight: bold; color: #ff3300; }}
                h1 {{ color: #fff; font-size: 24px; margin-bottom: 10px; }}
                .button {{ display: inline-block; background: linear-gradient(to right, #ff6600, #ff3300); color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 40px; color: #666; font-size: 12px; }}
                .link-text {{ word-break: break-all; color: #888; font-size: 12px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">LEADERLIX</div>
                    <h1>¡Bienvenido, {user_name}!</h1>
                    <p style="color: #888;">Gracias por registrarte. Solo necesitas verificar tu email para comenzar.</p>
                </div>
                
                <div style="text-align: center;">
                    <a href="{verification_url}" class="button">Verificar mi cuenta</a>
                </div>
                
                <p style="color: #ccc; text-align: center; margin-top: 30px;">
                    Si no creaste esta cuenta, puedes ignorar este mensaje.
                </p>
                
                <div class="link-text" style="text-align: center;">
                    <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
                    <p>{verification_url}</p>
                </div>
                
                <div class="footer">
                    <p>Este enlace expira en 24 horas.</p>
                    <p>© 2025 Leaderlix. Todos los derechos reservados.</p>
                    <p>10601 Clarence Dr., Suite 250, Frisco, TX 75033</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        plain_content = f"""
        ¡Bienvenido a Leaderlix, {user_name}!
        
        Gracias por registrarte. Por favor verifica tu email haciendo clic en el siguiente enlace:
        
        {verification_url}
        
        Si no creaste esta cuenta, puedes ignorar este mensaje.
        
        Este enlace expira en 24 horas.
        
        © 2025 Leaderlix
        """
        
        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            plain_content=plain_content
        )
    
    def is_configured(self) -> bool:
        """Check if AWS SES credentials are configured"""
        return bool(AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY)


# Singleton instance
email_service = EmailService()
