const mainView = document.querySelector("#main-view");
const loadingView = document.querySelector("#loading-view");
const errorView = document.querySelector("#error-view");

const statementsLoadingView = document.querySelector("#loading-statements-view");
const statementsErrorView = document.querySelector("#error-statements-view");
const statementsEmptyView = document.querySelector("#statements-empty-view");

const addExpenseScreenBackgroundElement = document.querySelector("#add-expense-screen-bg");
const addExpenseScreenElement = document.querySelector("#add-expense-screen");

const addSettlementScreenBackgroundElement = document.querySelector("#add-settlement-screen-bg");
const addSettlementScreenElement = document.querySelector("#add-settlement-screen");

const iPaidSwitchElement = document.querySelector("#i-paid-switch");
const theyPaidSwitchElement = document.querySelector("#they-paid-switch");

var whoPaidSelectedValue = null;

const amountField = document.querySelector("#amount-field");
const descriptionField = document.querySelector("#description-field");

const settlementAmountField = document.querySelector("#settlement-amount-field");

const entityPictureElement = document.querySelector("#profile-picture");
const entityTitleElement = document.querySelector("#entity-title");
const detailsDescriptionElement = document.querySelector("#total-statement-text");

const statementsContainer = document.querySelector("#statements-container");

var detailsDelayedLoaderTimeout = null;
var statementsDelayedLoaderTimeout = null;

var addExpenseScreenElementTimeout = null;
var addExpenseScreenBackgroundElementTimeout = null;

var addSettlementScreenElementTimeout = null;
var addSettlementScreenBackgroundElementTimeout = null;

const statementsArray = {};

const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
];

const MONTHS_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const SUCCESS = 1;
const LOADING = 0;
const ERROR = -1;
const EMPTY = 2;

const ENTITY_ID = location.pathname.split("/")[location.pathname.split("/").length - 1];
var ENTITY_AMOUNT = null;
var ENTITY_NAME = null;

function toggleView(flag)
{
    if (flag == SUCCESS)
    {
        loadingView.style.display = "none";
        errorView.style.display = "none";
        mainView.style.display = "inherit";
    }
    else if (flag == LOADING)
    {
        errorView.style.display = "none";
        mainView.style.display = "none";
        loadingView.style.display = "flex";
    }
    else if (flag == ERROR)
    {
        loadingView.style.display = "none";
        mainView.style.display = "none";
        errorView.style.display = "flex";
    }
    else
    {
        loadingView.style.display = "none";
        errorView.style.display = "none";
        mainView.style.display = "none";
    }
}

function toggleStatementsView(flag)
{
    if (flag == SUCCESS)
    {
        statementsLoadingView.style.display = "none";
        statementsErrorView.style.display = "none";
        statementsEmptyView.style.display = "none";
        statementsContainer.style.display = "flex";
    }
    else if (flag == EMPTY)
    {
        statementsLoadingView.style.display = "none";
        statementsErrorView.style.display = "none";
        statementsContainer.style.display = "none";
        statementsEmptyView.style.display = "flex";
    }
    else if (flag == LOADING)
    {
        statementsErrorView.style.display = "none";
        statementsEmptyView.style.display = "none";
        statementsContainer.style.display = "none";
        statementsLoadingView.style.display = "flex";
    }
    else if (flag == ERROR)
    {
        statementsLoadingView.style.display = "none";
        statementsEmptyView.style.display = "none";
        statementsContainer.style.display = "none";
        statementsErrorView.style.display = "flex";
    }
    else
    {
        statementsLoadingView.style.display = "none";
        statementsErrorView.style.display = "none";
        statementsEmptyView.style.display = "none";
        statementsContainer.style.display = "none";
    }
}

async function loadDetails()
{
    entityPictureElement.src = `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${ENTITY_ID}`;

    detailsDelayedLoaderTimeout = setTimeout(() => {
        toggleView(LOADING);
    }, 500);

    try
    {
        const res = await fetch(`/api/v1/entity/${ENTITY_ID}/`, { method: "GET" });
        const json = await res.json();

        // Prevent Loader
        if (detailsDelayedLoaderTimeout != null) clearTimeout(detailsDelayedLoaderTimeout);

        if (json["success"] == true)
        {
            if (json["type"] == "individual")
            {
                ENTITY_AMOUNT = json["amount"];
                ENTITY_NAME = json["name"];

                renderDetails();

                toggleView(SUCCESS);
            }
            else toggleView(ERROR);
        }
        else toggleView(ERROR);
    }
    catch
    {
        if (detailsDelayedLoaderTimeout != null) clearTimeout(detailsDelayedLoaderTimeout);
        toggleView(ERROR);
    }
}

function renderDetails()
{
    // Update Document Title
    document.title = `${ENTITY_NAME} - Details`;

    // Update UI
    entityTitleElement.innerText = ENTITY_NAME;

    detailsDescriptionElement.classList.remove("black", "profit", "loss");

    if (ENTITY_AMOUNT == 0)
    {
        detailsDescriptionElement.innerHTML = "You're settled up!";
    }
    else if (ENTITY_AMOUNT > 0)
    {
        detailsDescriptionElement.classList.add("profit");
        detailsDescriptionElement.innerHTML = `${ENTITY_NAME} owes you ${`₹${Math.abs(ENTITY_AMOUNT).toLocaleString("en-IN")}`}`;
    }
    else if (ENTITY_AMOUNT < 0)
    {
        detailsDescriptionElement.classList.add("loss");
        detailsDescriptionElement.innerHTML = `You owe ${ENTITY_NAME} ${`₹${Math.abs(ENTITY_AMOUNT).toLocaleString("en-IN")}`}`;
    }
    else
    {
        detailsDescriptionElement.innerHTML = `There's a conflict in the totals.`;
    }
}

function addStatement(statement_id, amount, description, statement_date)
{
    // Parse Date
    const dateObject = new Date(statement_date);

    // Compute GroupId
    const groupId = `${dateObject.getUTCMonth()}_${dateObject.getUTCFullYear()}`;

    // Create GroupId Object if Doesn't Exist
    if (statementsArray[groupId] == undefined)
        statementsArray[groupId] = []

    // Push Statement Details to Array
    statementsArray[groupId].push({
        "id": statement_id,
        "type": "statement",
        "amount": amount,
        "description": description,
        "date": statement_date
    });

    refresh_statements();
}

function addSettlement(settlement_id, amount, settlement_date)
{
    // Parse Date
    const dateObject = new Date(settlement_date);

    // Compute GroupId
    const groupId = `${dateObject.getUTCMonth()}_${dateObject.getUTCFullYear()}`;

    // Create GroupId Object if Doesn't Exist
    if (statementsArray[groupId] == undefined)
        statementsArray[groupId] = []

    // Push Statement Details to Array
    statementsArray[groupId].push({
        "id": settlement_id,
        "type": "settlement",
        "amount": amount,
        "date": settlement_date
    });

    refresh_statements();
}

function refresh_statements()
{
    statementsContainer.innerHTML = "";  // Clear All Statements From UI

    // Loop Through Statements
    Object.keys(statementsArray).slice().reverse().forEach(key => {
        statementsArray[key].slice().reverse().forEach(statement => {
            if (statement["type"] == "statement")
                addDOMStatement(
                    key,
                    statement["amount"],
                    statement["description"],
                    statement["date"]
                );
            else if (statement["type"] == "settlement")
                addDOMSettlement(
                    key,
                    statement["amount"],
                    statement["date"]
                );
        });
    });

    // Hide Loading
    toggleStatementsView((Object.keys(statementsArray).length <= 0) ? EMPTY : SUCCESS);
}

function addDOMStatement(groupId, amount, description, statementDate)
{
    // Group Exists?
    const groupDOMId = `statement-group-${groupId}`;
    var groupElement = document.querySelector(`#${groupDOMId}`);

    // Create New Group
    if (groupElement == null)
    {
        groupElement = document.createElement("div");
        groupElement.classList.add("statement-group");
        groupElement.id = groupDOMId;

        const groupTitleElement = document.createElement("div");
        groupTitleElement.classList.add("statement-group-title");
        groupTitleElement.innerText = `${MONTHS[new Date(statementDate).getUTCMonth()]} ${new Date(statementDate).getUTCFullYear()}`;

        groupElement.appendChild(groupTitleElement);
        statementsContainer.appendChild(groupElement);
    }

    // Create New Statement
    const statementItemElement = document.createElement("div");
    statementItemElement.classList.add("statement-item");

    const statementDateElement = document.createElement("div");
    statementDateElement.classList.add("statement-date");

    const statementDateMonthElement = document.createElement("span");
    statementDateMonthElement.classList.add("statement-date-month");
    statementDateMonthElement.innerText = MONTHS_SHORT[new Date(statementDate).getMonth()];

    const statementDateDayElement = document.createElement("span");
    statementDateDayElement.classList.add("statement-date-day");
    statementDateDayElement.innerText = (new Date(statementDate).getDate() > 9) ? new Date(statementDate).getDate() : `0${(new Date(statementDate).getDate()).toString()}`;

    statementDateElement.append(statementDateMonthElement, statementDateDayElement);

    const statementPictureElement = document.createElement("img");
    statementPictureElement.classList.add("statement-picture");
    statementPictureElement.src = "/static/images/statement.png";

    const labelsElement = document.createElement("div");
    labelsElement.classList.add("labels");

    const titleElement = document.createElement("span");
    titleElement.classList.add("statement-title");
    titleElement.innerText = description;

    const descriptionElement = document.createElement("span");
    descriptionElement.classList.add("statement-description");
    descriptionElement.innerText = (amount >= 0) ? `You paid ₹${Math.abs(amount).toLocaleString("en-IN")}` : `They paid ₹${Math.abs(amount).toLocaleString("en-IN")}`;

    labelsElement.append(titleElement, descriptionElement);

    const amountElement = document.createElement("span");
    amountElement.classList.add("statement-amount");
    amountElement.classList.add((amount >= 0) ? "profit" : "loss");
    amountElement.innerText = `₹${Math.abs(amount).toLocaleString("en-IN")}`;

    statementItemElement.append(
        statementDateElement,
        statementPictureElement,
        labelsElement,
        amountElement
    );

    animateDOMStatement(statementItemElement);

    // Add Statement
    groupElement.appendChild(statementItemElement);
}

function addDOMSettlement(groupId, amount, statementDate)
{
    // Group Exists?
    const groupDOMId = `statement-group-${groupId}`;
    var groupElement = document.querySelector(`#${groupDOMId}`);

    // Create New Group
    if (groupElement == null)
    {
        groupElement = document.createElement("div");
        groupElement.classList.add("statement-group");
        groupElement.id = groupDOMId;

        const groupTitleElement = document.createElement("div");
        groupTitleElement.classList.add("statement-group-title");
        groupTitleElement.innerText = `${MONTHS[new Date(statementDate).getUTCMonth()]} ${new Date(statementDate).getUTCFullYear()}`;

        groupElement.appendChild(groupTitleElement);
        statementsContainer.appendChild(groupElement);
    }

    // Create New Statement
    const settlementItemElement = document.createElement("div");
    settlementItemElement.classList.add("settlement-item");

    const settlementPictureElement = document.createElement("img");
    settlementPictureElement.classList.add("settlement-picture");
    settlementPictureElement.src = "/static/images/settlement.png";

    const settlementTextElement = document.createElement("span");
    settlementTextElement.classList.add("settlement-text");
    settlementTextElement.classList.add("profit");
    settlementTextElement.innerText = (amount >= 0) ? `You paid ₹${Math.abs(amount).toLocaleString("en-IN")}` : `They paid ₹${Math.abs(amount).toLocaleString("en-IN")}`;

    settlementItemElement.append(
        settlementPictureElement,
        settlementTextElement
    );

    animateDOMStatement(settlementItemElement);

    // Add Statement
    groupElement.appendChild(settlementItemElement);
}

function animateDOMStatement(element)
{
    element.animate(
        [
            {opacity: 0},
            {opacity: 1},
        ],
        {
            duration: 250,
            iterations: 1,
            fill: "forwards"
        }
    );
}

async function loadStatements()
{
    statementsDelayedLoaderTimeout = setTimeout(() => {
        toggleStatementsView(LOADING);
    }, 500);

    try
    {
        const res = await fetch(`/api/v1/statements/${ENTITY_ID}/`, { method: "GET" });
        const json = await res.json();

        // Prevent Loader
        if (statementsDelayedLoaderTimeout != null) clearTimeout(statementsDelayedLoaderTimeout);

        if (json["success"] == true)
        {
            // Save Statements
            json["statements"].forEach(statement => {
                if (statement["type"] == "statement")
                    addStatement(
                        statement["id"],
                        statement["amount"],
                        statement["description"],
                        statement["date"]
                    );
                else if (statement["type"] == "settlement")
                    addSettlement(
                        statement["id"],
                        statement["amount"],
                        statement["date"]
                    )
            });

            // Update UI
            refresh_statements();
        }
        else toggleStatementsView(ERROR);
    }
    catch
    {
        if (statementsDelayedLoaderTimeout != null) clearTimeout(statementsDelayedLoaderTimeout);
        toggleStatementsView(ERROR);
    }
}

function setWhoPaid(value)
{
    whoPaidSelectedValue = (value == "me" || value == "they") ? value : null;

    iPaidSwitchElement.classList.remove("who-paid-selected-switch");
    iPaidSwitchElement.classList.remove("who-paid-unselected-switch");

    theyPaidSwitchElement.classList.remove("who-paid-selected-switch");
    theyPaidSwitchElement.classList.remove("who-paid-unselected-switch");

    if (value == "me")
    {
        iPaidSwitchElement.classList.add("who-paid-selected-switch");
        theyPaidSwitchElement.classList.add("who-paid-unselected-switch");
    }
    else if (value == "they")
    {
        theyPaidSwitchElement.classList.add("who-paid-selected-switch");
        iPaidSwitchElement.classList.add("who-paid-unselected-switch");
    }
    else
    {
        iPaidSwitchElement.classList.add("who-paid-unselected-switch");
        theyPaidSwitchElement.classList.add("who-paid-unselected-switch");
    }
}

function toggleAddExpenseScreen(value)
{
    amountField.style.width = "1ch";

    amountField.value = "";
    descriptionField.value = "";

    setWhoPaid(null);

    clearTimeout(addExpenseScreenElementTimeout);
    clearTimeout(addExpenseScreenBackgroundElementTimeout);

    if (value == true)
    {
        addExpenseScreenElement.animate(
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

        addExpenseScreenBackgroundElement.animate(
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

        addExpenseScreenBackgroundElement.style.display = "flex";
        addExpenseScreenElement.style.display = "flex";

        theyPaidSwitchElement.innerText = ENTITY_NAME;

        amountField.focus();
    }
    else
    {
        addExpenseScreenElement.animate(
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

        addExpenseScreenBackgroundElement.animate(
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

        addExpenseScreenElementTimeout = setTimeout(() => {
            addExpenseScreenElement.style.display = "none";
        }, 200);
        
        addExpenseScreenBackgroundElementTimeout = setTimeout(() => {
            addExpenseScreenBackgroundElement.style.display = "none";
        }, 100);
    }
}

function toggleAddSettlementScreen(value)
{
    settlementAmountField.style.width = "1ch";

    settlementAmountField.value = "";

    clearTimeout(addSettlementScreenElementTimeout);
    clearTimeout(addSettlementScreenBackgroundElementTimeout);

    if (value == true)
    {
        // Entity Amount - NULL
        if (ENTITY_AMOUNT == null) return toastError("Can't settle up!");

        // Already Settled Up
        if (ENTITY_AMOUNT == 0) return toast("You're already settled up!");

        addSettlementScreenElement.animate(
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

        addSettlementScreenBackgroundElement.animate(
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

        document.querySelector("#add-settlement-screen .title").innerText = (ENTITY_AMOUNT > 0 ? "They paid" : "You paid");

        addSettlementScreenBackgroundElement.style.display = "flex";
        addSettlementScreenElement.style.display = "flex";

        settlementAmountField.focus();
    }
    else
    {
        addSettlementScreenElement.animate(
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

        addSettlementScreenBackgroundElement.animate(
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

        addSettlementScreenElementTimeout = setTimeout(() => {
            addSettlementScreenElement.style.display = "none";
        }, 200);
        
        addSettlementScreenBackgroundElementTimeout = setTimeout(() => {
            addSettlementScreenBackgroundElement.style.display = "none";
        }, 100);
    }
}

function addExpenseAction()
{
    try
    {
        const amount = amountField.value.trim();
        if (amount == "" || isNaN(amount)) return toastError("Please enter a valid amount.");

        var description = descriptionField.value.trim();
        if (description == "") description = "Payment";

        if (whoPaidSelectedValue != "me" && whoPaidSelectedValue != "they")
            return toastError("Please select who paid");

        initiateAddExpense(
            ENTITY_ID,
            (whoPaidSelectedValue == "me") ? Math.abs(parseInt(amount)) : -Math.abs(parseInt(amount)),
            description
        );

        toggleAddExpenseScreen(false);
    }
    catch
    {
        toastError("Please enter valid details.");
    }
}

function settleAction()
{
    try
    {
        const amount = settlementAmountField.value.trim();
        if (amount == "" || isNaN(amount)) return toastError("Please enter a valid amount.");

        toggleAddSettlementScreen(false);

        initiateSettlement(
            ENTITY_ID,
            parseInt(ENTITY_AMOUNT > 0 ? -amount : amount)
        );
    }
    catch
    {
        toastError("Please enter a valid amount.");
    }
}

function initiateAddExpense(entity_id, amount, description)
{
    fetch("/api/v1/statement/", {
        method: "POST",
        body: JSON.stringify({
            "entity_id": entity_id,
            "amount": amount,
            "description": description
        }),
        headers: {
            "content-type": "application/json"
        }
    }).then(res => {
        res.json().then(json => {
            if (json["success"] == true)
            {
                // Save Statements
                addStatement(
                    json["statement_id"],
                    amount,
                    description,
                    json["date"]
                );

                // Update UI
                refresh_statements();

                // Update Total Amount
                ENTITY_AMOUNT += amount;
                renderDetails();
            }
            else toastError(json["error"]);
        }).catch(() => {
            toastError("Internal server error!");
        });
    }).catch(() => {
        toastError("Something went wrong!");
    });
}

function initiateSettlement(entity_id, amount)
{
    fetch("/api/v1/settle/", {
        method: "POST",
        body: JSON.stringify({
            "entity_id": entity_id,
            "amount": amount
        }),
        headers: {
            "content-type": "application/json"
        }
    }).then(res => {
        res.json().then(json => {
            if (json["success"] == true)
            {
                // Save Statements
                addSettlement(
                    json["statement_id"],
                    amount,
                    json["date"]
                );

                // Update UI
                refresh_statements();

                // Update Total Amount
                ENTITY_AMOUNT += amount;
                renderDetails();
            }
            else toastError(json["error"]);
        }).catch(() => {
            toastError("Something went wrong!");
        });
    }).catch(() => {
        toastError("Something went wrong!");
    });
}

function adjustAmountField(input)
{
    const MAX_CHARS = 4;
    input.style.width = `${Math.max(1, Math.min(input.value.length, MAX_CHARS))}ch`;
}

(async () => {
    await Promise.all([loadDetails(), loadStatements()]);
})();
