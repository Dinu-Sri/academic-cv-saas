"""Academic CV SaaS - Main Reflex Application"""
import reflex as rx
from app.config import settings

# Import pages (will be created)
# from app.pages import auth, dashboard, editor, templates, settings as settings_page


class State(rx.State):
    """Main application state"""
    pass


def index() -> rx.Component:
    """Landing page"""
    return rx.container(
        rx.vstack(
            rx.heading(
                "Academic CV SaaS",
                size="9",
                weight="bold",
            ),
            rx.text(
                "Professional LaTeX-powered CV builder for academics",
                size="5",
                color_scheme="gray",
            ),
            rx.hstack(
                rx.button(
                    "Get Started",
                    size="3",
                    variant="solid",
                    on_click=lambda: rx.redirect("/signup"),
                ),
                rx.button(
                    "Login",
                    size="3",
                    variant="outline",
                    on_click=lambda: rx.redirect("/login"),
                ),
                spacing="4",
            ),
            spacing="6",
            align="center",
            min_height="80vh",
            justify="center",
        ),
        size="3",
    )


# Create the app
app = rx.App(
    theme=rx.theme(
        appearance="light",
        accent_color="blue",
    ),
)

# Add pages
app.add_page(index, route="/")
# app.add_page(auth.login, route="/login")
# app.add_page(auth.signup, route="/signup")
# app.add_page(dashboard.dashboard, route="/dashboard")
# app.add_page(editor.editor, route="/editor")
# app.add_page(templates.templates_gallery, route="/templates")
# app.add_page(settings_page.settings, route="/settings")

# Health check endpoint
@app.api.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "version": "1.0.0"
    }
