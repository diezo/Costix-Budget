const TOAST_TIMEOUT = 3500;

function toastError(message)
{
    toast(message, isError=true);
}

function toast(message, isError)
{
    // Clear Previous Toasts
    Array.from(document.querySelectorAll(".toast-view")).forEach(element => {
        element.remove();
    });

    const toastElement = document.createElement("div");
    toastElement.classList.add("toast-view");
    toastElement.innerText = message;

    toastElement.addEventListener("click", () => cancelToast(toastElement));

    if (isError == true)
    {
        toastElement.style.color = "#CD2656";
        toastElement.style.backgroundColor = "#FBEAEC";
        toastElement.style.borderColor = "#F6D5DB";
    }

    toastElement.animate(
        [
            {opacity: 0, transform: `translateX(-50%) scale(0.92, 0.92)`},
            {opacity: 0.75, transform: `translateX(-50%) scale(1.035, 1.035)`},
            {opacity: 1, transform: `translateX(-50%) scale(1, 1)`},
        ],
        {
            duration: 350,
            iterations: 1,
            fill: "forwards"
        }
    )

    setTimeout(() => cancelToast(toastElement), TOAST_TIMEOUT);

    document.body.appendChild(toastElement);
}

function cancelToast(element)
{
    element.animate(
        [
            {opacity: 1, transform: `translateX(-50%) scale(1, 1)`},
            {opacity: 0, transform: `translateX(-50%) scale(0.95, 0.95)`},
        ],
        {
            duration: 350,
            iterations: 1,
            fill: "forwards"
        }
    )

    setTimeout(() => element.remove(), 350);
}