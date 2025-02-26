const LOADING = 0;
const SUCCESS = 1;
const ERROR = -1;
const EMPTY = 2;

var FULL_NAME = null;
var UID = null;

var totalOweRequestController = new AbortController();
var loadEntitiesRequestController = new AbortController();

const miniProfileViewElement = document.querySelector("#mini-profile-view");
const miniProfileViewPictureElement = document.querySelector("#mini-profile-view-picture");
const miniProfileViewNameElement = document.querySelector("#mini-profile-view-name");

const entitiesContainerView = document.querySelector("#entities-container");
const entitiesLoadingView = document.querySelector("#entities-loading");
const entitiesLoadingErrorView = document.querySelector("#entities-loading-error");
const entitiesEmptyView = document.querySelector("#entities-empty");

const deleteEntityButtonElement = document.querySelector("#delete-entity-button");
const renameEntityButtonElement = document.querySelector("#rename-entity-button");
const exportEntityButtonElement = document.querySelector("#export-entity-button");

const entityOptionsScreenProfileSection = document.querySelector("#entity-options-screen-profile-section");

const addEntityScreenBackgroundElement = document.querySelector("#add-entity-screen-bg");
const addEntityScreenElement = document.querySelector("#add-entity-screen");

const entityOptionsScreenBackgroundElement = document.querySelector("#entity-options-screen-bg");
const entityOptionsScreenElement = document.querySelector("#entity-options-screen");

const fullNameFieldElement = document.querySelector("#full-name-field");

const totalOweAmountElement = document.querySelector("#total-difference-amount");

var entitiesDelayedLoaderTimeout = null;

var addEntityScreenElementTimeout = null;
var addEntityScreenBackgroundElementTimeout = null;

var entityOptionsScreenElementTimeout = null;
var entityOptionsScreenBackgroundElementTimeout = null;

const entitiesArray = [];

function computeRelativeTime(timeObject)
{
    const now = new Date(new Date().toISOString().replace("Z", ""));
    const date = new Date(timeObject);

    const years = now.getFullYear() - date.getFullYear();
    const months = now.getMonth() - date.getMonth();
    const days = now.getDate() - date.getDate();
    const hours = now.getHours() - date.getHours();
    const minutes = now.getMinutes() - date.getMinutes();

    if (years > 0) return `${years} year${years > 1 ? "s" : ""} ago`;
    if (months > 0) return `${months} month${months > 1 ? "s" : ""} ago`;
    if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    
    else return `seconds ago`;
}

function addIndividualEntity(index, entityId, entityName, entityAmount, lastUpdated)
{
    const ghostEntityOpacity = 0.4;

    const entityElement = document.createElement("div");
    entityElement.classList.add("entity-item");

    if (entityAmount == 0) entityElement.style.opacity = ghostEntityOpacity.toString();

    entityElement.addEventListener("click", () => {
        window.open(`/details/${entityId}`, "_blank");
    });

    const entityIdElement = document.createElement("span");
    entityIdElement.classList.add("entity-id");
    entityIdElement.innerText = entityId;

    const entityPictureElement = document.createElement("img");
    entityPictureElement.classList.add("entity-picture");
    entityPictureElement.src = `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${entityId}`;

    const entityInfoElement = document.createElement("div");
    entityInfoElement.classList.add("entity-info");

    const entityNameElement = document.createElement("span");
    entityNameElement.classList.add("entity-name");
    entityNameElement.innerText = entityName;

    const entityDescriptionElement = document.createElement("span");
    entityDescriptionElement.classList.add("entity-description");
    entityDescriptionElement.innerText = computeRelativeTime(lastUpdated);

    if (entityAmount == 0)
    {
        const newOpacity = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--entity-description-opacity").trim()) + ghostEntityOpacity).toFixed(1).toString();
        entityDescriptionElement.style.opacity = newOpacity;
    }

    entityInfoElement.append(entityNameElement, entityDescriptionElement);

    const spacerElement = document.createElement("div");
    spacerElement.classList.add("spacer");

    const entityAmountElement = document.createElement("span");
    entityAmountElement.classList.add("entity-amount");

    if (entityAmount != 0)
    {
        entityAmountElement.classList.add(entityAmount >= 0 ? "profit" : "loss");
        entityAmountElement.innerText = `₹${Math.abs(entityAmount).toLocaleString("en-IN")}`;
    }

    const menuElement = document.createElement("div");
    menuElement.classList.add("menu-button");
    menuElement.innerHTML = "<i class='fa fa-ellipsis-v'></i>";

    menuElement.addEventListener("click", event => {
        toggleEntityOptionsScreen(true, entityId, entityName);
        event.stopPropagation();
    });
    
    entityElement.append(
        entityIdElement,
        entityPictureElement,
        entityInfoElement,
        spacerElement,
        entityAmountElement,
        menuElement
    );

    setTimeout(() => {
        if (entityAmount != 0)
        {
            entityElement.animate(
                [
                    {opacity: 0.75, transform: `scale(0.97, 0.97)`},
                    {opacity: 0.875, transform: `scale(1.01, 1.01)`},
                    {opacity: 1, transform: `scale(1, 1)`},
                ],
                {
                    duration: 400,
                    iterations: 1,
                    fill: "forwards"
                }
            );
        }
        else
        {
            entityElement.animate(
                [
                    {opacity: 0.25, transform: `scale(0.97, 0.97)`},
                    {opacity: 0.325, transform: `scale(1.01, 1.01)`},
                    {opacity: ghostEntityOpacity, transform: `scale(1, 1)`},
                ],
                {
                    duration: 400,
                    iterations: 1,
                    fill: "forwards"
                }
            );
        }
    }, index * 10);

    entitiesContainerView.appendChild(entityElement);
}

async function loadEntities()
{
    // Abort Previous Requests
    if (loadEntitiesRequestController) loadEntitiesRequestController.abort();

    loadEntitiesRequestController = new AbortController();
    const signal = loadEntitiesRequestController.signal;

    entitiesArray.length = 0;

    entitiesDelayedLoaderTimeout = setTimeout(() => {
        toggleEntitiesView(LOADING);
    }, 500);

    try
    {
        const res = await fetch("/api/v1/entities/", { method: "GET", signal: signal });
        const array = await res.json();

        // Prevent Loader
        if (entitiesDelayedLoaderTimeout != null) clearTimeout(entitiesDelayedLoaderTimeout);
        
        // Save Entity
        array.forEach(element => {
            entitiesArray.push({
                "id": element["entity_id"],
                "type": element["type"],
                "name": element["name"],
                "amount": element["amount"],
                "last_updated": element["last_updated"]
            });
        });

        // Update UI
        refreshEntities();
    }
    catch
    {
        if (entitiesDelayedLoaderTimeout != null) clearTimeout(entitiesDelayedLoaderTimeout);
        toggleEntitiesView(ERROR);
    }
}

function refreshEntities()
{
    // Clear DOM Entities
    entitiesContainerView.innerHTML = "";

    let i = 0;

    // Render Entities from Array
    entitiesArray.slice().sort(
        (a, b) => Math.abs(b.amount) - Math.abs(a.amount)
    ).forEach(element => {
        if (element["type"] == "individual")
        {
            addIndividualEntity(
                i,
                element["id"],
                element["name"],
                element["amount"],
                element["last_updated"]
            );
        }

        i++;
    });

    // Hide Loading
    toggleEntitiesView((entitiesArray.length <= 0) ? EMPTY : SUCCESS);
}

function toggleEntitiesView(flag)
{
    if (flag == LOADING)
    {
        entitiesContainerView.style.display = "none";
        entitiesLoadingErrorView.style.display = "none";
        entitiesEmptyView.style.display = "none";
        entitiesLoadingView.style.display = "inherit";
    }
    else if (flag == SUCCESS)
    {
        entitiesLoadingView.style.display = "none";
        entitiesLoadingErrorView.style.display = "none";
        entitiesEmptyView.style.display = "none";
        entitiesContainerView.style.display = "block";
    }
    else if (flag == ERROR)
    {
        entitiesLoadingView.style.display = "none";
        entitiesContainerView.style.display = "none";
        entitiesEmptyView.style.display = "none";
        entitiesLoadingErrorView.style.display = "inherit";
    }
    else if (flag == EMPTY)
    {
        entitiesLoadingView.style.display = "none";
        entitiesContainerView.style.display = "none";
        entitiesLoadingErrorView.style.display = "none";
        entitiesEmptyView.style.display = "inherit";
    }
    else
    {
        entitiesLoadingView.style.display = "none";
        entitiesContainerView.style.display = "none";
        entitiesLoadingErrorView.style.display = "none";
        entitiesEmptyView.style.display = "none";
    }
}

function addIndividualAction()
{
    const entityName = fullNameFieldElement.value.trim();

    if (entityName == "") return toastError("Please enter a valid name");

    toggleAddEntityScreen(false);

    initiateAddIndividual(entityName);
}

function initiateAddIndividual(entityName)
{
    fetch("/api/v1/create-entity/", {
        method: "POST",
        body: JSON.stringify({
            "type": "individual",
            "name": entityName
        }),
        headers: {
            "content-type": "application/json"
        }
    }).then(res => {
        res.json().then(json => {
            if (json["success"] == true)
            {
                entitiesArray.push({
                    "id": json["entity_id"],
                    "type": "individual",
                    "name": entityName,
                    "amount": 0,
                    "last_updated": new Date().toISOString().replace("Z", "")
                });

                refreshEntities();
            }
            else toastError(json["error"]);
        }).catch(() => {
            toastError("Internal server error!");
        });
    }).catch(() => {
        toastError("Something went wrong.");
    });
}

function initiateDeleteEntity(entityId)
{
    fetch(`/api/v1/delete-entity/${entityId}/`, {
        method: "DELETE"
    }).then(res => {
        res.json().then(json => {
            if (json["success"] == true)
            {
                i = 0;

                entitiesArray.forEach(element => {
                    if (element["id"] == entityId)
                    {
                        entitiesArray.splice(i, 1);
                    }

                    i++;
                });

                refreshEntities();
                loadTotalOwe();
            }
            else toastError(json["error"]);
        }).catch(() => {
            toastError("Internal server error!");
        });
    }).catch(() => {
        toastError("Something went wrong.");
    });
}

async function loadTotalOwe()
{
    // Abort Previous Requests
    if (totalOweRequestController) totalOweRequestController.abort();

    totalOweRequestController = new AbortController();
    const signal = totalOweRequestController.signal;

    try
    {
        const extended = (miniProfileViewElement.style.display == "none" || miniProfileViewElement.style.display == "") ? "extended" : "normal";

        const res = await fetch(`/api/v1/total-owe/${extended}`, { method: "GET", signal: signal });
        const json = await res.json();

        if (json["success"] == true)
        {
            if (miniProfileViewElement.style.display == "none" || miniProfileViewElement.style.display == "")
            {
                FULL_NAME = json["display_name"];
                UID = json["uid"];
                showSettingsButton();
            }

            totalOweAmountElement.classList.remove("profit", "loss");

            totalOweAmountElement.classList.add(json["amount"] >= 0 ? "profit" : "loss");
            totalOweAmountElement.innerText = `₹${Math.abs(json["amount"]).toLocaleString("en-IN")}`;

            totalOweAmountElement.animate(
                [
                    {opacity: 0, transform: `scale(0.95, 0.95)`},
                    {opacity: 0.75, transform: `scale(1.01, 1.01)`},
                    {opacity: 1, transform: `scale(1, 1)`},
                ],
                {
                    duration: 400,
                    iterations: 1,
                    fill: "forwards"
                }
            );
        }
    }
    catch {}
}

function toggleAddEntityScreen(value)
{
    fullNameFieldElement.value = "";

    clearTimeout(addEntityScreenElementTimeout);
    clearTimeout(addEntityScreenBackgroundElementTimeout);

    if (value == true)
    {
        addEntityScreenElement.animate(
            [
                {opacity: 0.75, transform: `translate(-50%, -50%) scale(0.975, 0.975)`},
                {opacity: 0.875, transform: `translate(-50%, -50%) scale(1.005, 1.005)`},
                {opacity: 1, transform: `translate(-50%, -50%) scale(1, 1)`},
            ],
            {
                duration: 400,
                iterations: 1,
                fill: "forwards"
            }
        );

        addEntityScreenBackgroundElement.animate(
            [
                {opacity: 0.75},
                {opacity: 0.875},
                {opacity: 1},
            ],
            {
                duration: 200,
                iterations: 1,
                fill: "forwards"
            }
        );

        addEntityScreenBackgroundElement.style.display = "flex";
        addEntityScreenElement.style.display = "flex";

        fullNameFieldElement.focus();
    }
    else
    {
        addEntityScreenElement.animate(
            [
                {opacity: 1, transform: `translate(-50%, -50%) scale(1, 1)`},
                {opacity: 0, transform: `translate(-50%, -50%) scale(0.9, 0.9)`},
            ],
            {
                duration: 200,
                iterations: 1,
                fill: "forwards"
            }
        );

        addEntityScreenBackgroundElement.animate(
            [
                {opacity: 1},
                {opacity: 0},
            ],
            {
                duration: 100,
                iterations: 1,
                fill: "forwards"
            }
        );

        addEntityScreenElementTimeout = setTimeout(() => {
            addEntityScreenElement.style.display = "none";
        }, 200);
        
        addEntityScreenBackgroundElementTimeout = setTimeout(() => {
            addEntityScreenBackgroundElement.style.display = "none";
        }, 100);
    }
}

function toggleEntityOptionsScreen(value, entityId, entityName)
{
    clearTimeout(entityOptionsScreenElementTimeout);
    clearTimeout(entityOptionsScreenBackgroundElementTimeout);

    if (value == true)
    {
        entityOptionsScreenElement.animate(
            [
                {opacity: 0.75, transform: `translate(-50%, -50%) scale(0.975, 0.975)`},
                {opacity: 0.875, transform: `translate(-50%, -50%) scale(1.005, 1.005)`},
                {opacity: 1, transform: `translate(-50%, -50%) scale(1, 1)`},
            ],
            {
                duration: 400,
                iterations: 1,
                fill: "forwards"
            }
        );

        entityOptionsScreenBackgroundElement.animate(
            [
                {opacity: 0.75},
                {opacity: 0.875},
                {opacity: 1},
            ],
            {
                duration: 200,
                iterations: 1,
                fill: "forwards"
            }
        );

        entityOptionsScreenProfileSection.querySelector(".picture").src = `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${entityId}`;
        entityOptionsScreenProfileSection.querySelector(".title").innerText = entityName;

        deleteEntityButtonElement.onclick = () => {
            toggleEntityOptionsScreen(false);

            if (confirm("You sure, delete it?"))
                initiateDeleteEntity(entityId);
        };

        entityOptionsScreenBackgroundElement.style.display = "flex";
        entityOptionsScreenElement.style.display = "flex";
    }
    else
    {
        entityOptionsScreenElement.animate(
            [
                {opacity: 1, transform: `translate(-50%, -50%) scale(1, 1)`},
                {opacity: 0, transform: `translate(-50%, -50%) scale(0.9, 0.9)`},
            ],
            {
                duration: 200,
                iterations: 1,
                fill: "forwards"
            }
        );

        entityOptionsScreenBackgroundElement.animate(
            [
                {opacity: 1},
                {opacity: 0},
            ],
            {
                duration: 100,
                iterations: 1,
                fill: "forwards"
            }
        );

        entityOptionsScreenElementTimeout = setTimeout(() => {
            entityOptionsScreenElement.style.display = "none";
        }, 200);
        
        entityOptionsScreenBackgroundElementTimeout = setTimeout(() => {
            entityOptionsScreenBackgroundElement.style.display = "none";
        }, 100);
    }
}

function showSettingsButton()
{
    miniProfileViewPictureElement.src = `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${UID}`;
    miniProfileViewNameElement.innerText = FULL_NAME;
    
    miniProfileViewElement.style.display = "flex";

    miniProfileViewElement.animate(
        [
            {opacity: 0.75, transform: `scale(0.97, 0.97)`},
            {opacity: 0.875, transform: `scale(1.01, 1.01)`},
            {opacity: 1, transform: `scale(1, 1)`},
        ],
        {
            duration: 400,
            iterations: 1,
            fill: "forwards"
        }
    );
}

// Update Total-Owe When Page Visibility Changes
document.addEventListener("visibilitychange", async () => {
    if (!document.hidden) init();
}); 

async function init()
{
    await Promise.all([loadEntities(), loadTotalOwe()]);
}

init();
