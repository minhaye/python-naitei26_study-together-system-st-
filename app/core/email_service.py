import logging
import smtplib
from email.message import EmailMessage
from typing import Protocol

from app.core.config import settings

logger = logging.getLogger("app.email")


class EmailService(Protocol):
    def send(self, to: str, subject: str, body: str) -> None: ...


class SmtpEmailService:
    """Sends mail via a configured SMTP relay (stdlib smtplib -- no extra dependency).
    Works with any provider that exposes an SMTP endpoint (Gmail, SendGrid, Mailgun,
    Postmark, ...); provider selection is an operator/config concern, not a code concern."""

    def send(self, to: str, subject: str, body: str) -> None:
        message = EmailMessage()
        message["From"] = settings.email_from_address or "no-reply@study-together.local"
        message["To"] = to
        message["Subject"] = subject
        message.set_content(body)

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_username and settings.smtp_password:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)


class ConsoleEmailService:
    """Fallback used whenever SMTP isn't configured (no smtp_host set). Logs the message
    instead of silently pretending to have sent it -- keeps the invitation feature fully
    testable/usable in development without requiring a real mail provider, while making the
    missing production configuration explicit rather than hidden."""

    def send(self, to: str, subject: str, body: str) -> None:
        logger.warning(
            "SMTP not configured (settings.smtp_host is unset) -- email NOT sent.\n"
            "To: %s\nSubject: %s\n%s",
            to,
            subject,
            body,
        )


def _build_email_service() -> EmailService:
    if settings.smtp_host:
        return SmtpEmailService()
    return ConsoleEmailService()


email_service: EmailService = _build_email_service()


def send_invitation_email(to: str, inviter_name: str, target_label: str, link: str, expires_in_minutes: int) -> None:
    subject = f"{inviter_name} invited you to join {target_label}"
    body = (
        f"{inviter_name} invited you to join \"{target_label}\" on Study Together.\n\n"
        f"Open this link to accept or decline (expires in {expires_in_minutes} minutes):\n{link}\n\n"
        "If you weren't expecting this invitation, you can ignore this email."
    )
    email_service.send(to, subject, body)
