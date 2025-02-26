from smtplib import SMTP
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr


class EmailServer:
    """
    Manages sending emails from the official email address.
    """

    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587

    username: str = None
    password: str = None

    sender_name: str = None
    sender_email: str = None

    server: SMTP = None


    def __init__(self, username: str, password: str, sender_name: str, sender_email: str = None):
        """
        Initializes the SMTP server.
        """

        self.username = username
        self.password = password
        
        self.sender_name = sender_name

        if sender_email is None: self.sender_email = username
        else: self.sender_email = sender_email

        self.server = SMTP(self.SMTP_HOST, self.SMTP_PORT)
        self.server.starttls()
        self.server.login(self.username, self.password)
    

    def send_email(self, recipient_email: str, subject: str, text: str):
        """
        Sends email to given recipient email address.
        """

        # Prepare Email
        message: MIMEMultipart = MIMEMultipart()
        message["From"] = formataddr((self.sender_name, self.sender_email))
        message["To"] = recipient_email
        message["Subject"] = subject
        message.attach(MIMEText(text, "plain"))

        # Send Email
        try:
            self.server.sendmail(
                self.sender_email,
                recipient_email,
                message.as_string()
            )

            return True
        
        # Handle Error
        except Exception as e:
            print(e)
            return False


    def __del__(self):
        """
        Close all connections before destroying class.
        """
        self.server.close()
