const VIEW_LOGIN = 0;
const VIEW_SIGNUP = 1;

const loginView = document.querySelector("#login-view");
const signupView = document.querySelector("#signup-view");

const loginEmailField = document.querySelector("#login-email-field");
const loginPasswordField = document.querySelector("#login-password-field");

const loginButton = document.querySelector("#login-button");
const signupButton = document.querySelector("#signup-button");

const signupDisplayNameField = document.querySelector("#signup-display-name-field");
const signupEmailField = document.querySelector("#signup-email-field");
const signupPasswordField = document.querySelector("#signup-password-field");

function toggleView(flag)
{
    if (flag == VIEW_LOGIN)
    {
        document.title = "Login - Costix";

        signupView.style.display = "none";
        loginView.style.display = "inherit";

        loginEmailField.focus();
    }
    else if (flag == VIEW_SIGNUP)
    {
        document.title = "Sign up - Costix";

        loginView.style.display = "none";
        signupView.style.display = "inherit";

        signupDisplayNameField.focus();
    }
    else
    {
        document.title = "Costix";

        loginView.style.display = "none";
        signupView.style.display = "none";
    }
}

function loginAction()
{
    // Gather Data
    const email = loginEmailField.value.trim();
    const password = loginPasswordField.value.trim();

    // Validate Data
    if (email == "") return toastError("Enter a valid email");
    if (password == "") return toastError("Enter a valid password");

    // Hit API Endpoint
    initiateLogin(email, password);
}

function signupAction()
{
    // Gather Data
    const displayName = signupDisplayNameField.value.trim();
    const email = signupEmailField.value.trim();
    const password = signupPasswordField.value.trim();

    // Validate Data
    if (displayName == "") return toastError("Enter a valid name");
    if (email == "") return toastError("Enter a valid email");
    if (password == "") return toastError("Enter a valid password");

    // Hit API Endpoint
    initiateSignup(displayName, email, password);
}

function initiateLogin(email, password)
{
    setLoginButtonEnabled(false);

    fetch("/api/v1/login/", {
        method: "POST",
        body: JSON.stringify({
            "email": email,
            "password": password,
        }),
        headers: {
            "content-type": "application/json"
        },
        credentials: "include"
    }).then(res => {
        res.json().then(json => {
            if (json["success"] == true) location.reload();
            else
            {
                toastError(json["error"])
                setLoginButtonEnabled(true);
            };
        }).catch(() => {
            toastError("Ahh! Something went wrong");
            setLoginButtonEnabled(true);
        });
    }).catch(() => {
        toastError("Ahh! Something went wrong");
        setLoginButtonEnabled(true);
    });
}

function setLoginButtonEnabled(enabled)
{
    if (typeof enabled == "boolean")
    {
        loginButton.disabled = !enabled;
    }
}

function setSignupButtonEnabled(enabled)
{
    if (typeof enabled == "boolean")
    {
        signupButton.disabled = !enabled;
    }
}

function initiateSignup(displayName, email, password)
{
    setSignupButtonEnabled(false);

    fetch("/api/v1/signup/", {
        method: "POST",
        body: JSON.stringify({
            "display_name": displayName,
            "email": email,
            "password": password,
        }),
        headers: {
            "content-type": "application/json"
        }
    }).then(res => {
        res.json().then(json => {
            if (json["success"] == true)
            {
                toast("We've sent you an account activation link through email!");
                toggleView(VIEW_LOGIN);
            }
            else
            {
                toastError(json["error"]);
                setSignupButtonEnabled(true);
            }
        }).catch(() => {
            toastError("Ahh! Something went wrong");
            setSignupButtonEnabled(true);
        });
    }).catch(() => {
        toastError("Ahh! Something went wrong");
        setSignupButtonEnabled(true);
    });
}

loginEmailField.addEventListener("keypress", event => {
    if (event.keyCode == 13) loginPasswordField.focus();
});

loginPasswordField.addEventListener("keypress", event => {
    if (event.keyCode == 13) loginAction();
});

document.addEventListener("DOMContentLoaded", () => {
    loginEmailField.focus();
});

signupDisplayNameField.addEventListener("keypress", event => {
    if (event.keyCode == 13) signupEmailField.focus();
});

signupEmailField.addEventListener("keypress", event => {
    if (event.keyCode == 13) signupPasswordField.focus();
});

signupPasswordField.addEventListener("keypress", event => {
    if (event.keyCode == 13) signupAction();
});