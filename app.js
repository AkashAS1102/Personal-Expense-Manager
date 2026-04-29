const LOCAL_STORAGE_KEY = "expense-manager-local-entries";
const CURRENCY_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const CHART_COLORS = [
  "#0C8F72",
  "#1F6F8B",
  "#F29F67",
  "#E76F51",
  "#A44A6E",
  "#6374C3",
  "#7CA982",
  "#D4A017",
];

const elements = {
  totalSpend: document.getElementById("totalSpend"),
  recordCount: document.getElementById("recordCount"),
  topCategory: document.getElementById("topCategory"),
  topCategoryAmount: document.getElementById("topCategoryAmount"),
  categoryTotals: document.getElementById("categoryTotals"),
  expenseTableBody: document.getElementById("expenseTableBody"),
  chartLegend: document.getElementById("chartLegend"),
  sheetStatus: document.getElementById("sheetStatus"),
  sheetHelp: document.getElementById("sheetHelp"),
  modal: document.getElementById("expenseModal"),
  form: document.getElementById("expenseForm"),
  openModalBtn: document.getElementById("openModalBtn"),
  closeModalBtn: document.getElementById("closeModalBtn"),
};

let expenseChart;
let allExpenses = [];

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (character === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  values.push(current.trim());
  return values;
}

function csvToObjects(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return [];
  }

  const [headerLine, ...rows] = lines;
  const headers = parseCsvLine(headerLine).map((header) => header.toLowerCase());

  return rows.map((row) => {
    const values = parseCsvLine(row);
    return headers.reduce((entry, header, index) => {
      entry[header] = values[index] ?? "";
      return entry;
    }, {});
  });
}

function hasLedgerHeaders(rows) {
  if (!rows.length) {
    return false;
  }

  const firstRow = rows[0];
  return ["date", "amount", "category", "description"].every((key) => key in firstRow);
}

function normalizeExpense(entry) {
  const amountValue = Number.parseFloat(String(entry.amount).replace(/[^0-9.-]+/g, ""));

  if (!entry.date || Number.isNaN(amountValue) || !entry.category) {
    return null;
  }

  return {
    date: entry.date,
    amount: amountValue,
    category: entry.category.trim(),
    description: (entry.description || "No description").trim(),
    source: entry.source || "sheet",
  };
}

function readLocalExpenses() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeExpense).filter(Boolean) : [];
  } catch (error) {
    console.error("Failed to load local expenses", error);
    return [];
  }
}

function saveLocalExpenses(expenses) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(expenses));
}

async function fetchSheetExpenses() {
  const response = await fetch("/api/expenses");

  if (!response.ok) {
    throw new Error(`Sheet request failed with status ${response.status}`);
  }

  const payload = await response.json();

  return {
    expenses: (payload.rows || [])
      .map((row) => normalizeExpense({ ...row, source: "sheet" }))
      .filter(Boolean),
    state: payload.state || "unreachable",
    source: payload.source || "api",
  };
}

function combineExpenses(sheetExpenses, localExpenses) {
  return [...localExpenses, ...sheetExpenses].sort((left, right) => {
    return new Date(right.date) - new Date(left.date);
  });
}

function summarizeByCategory(expenses) {
  return expenses.reduce((totals, expense) => {
    const normalizedCategory = expense.category.trim();
    totals[normalizedCategory] = (totals[normalizedCategory] || 0) + expense.amount;
    return totals;
  }, {});
}

function formatCurrency(value) {
  return CURRENCY_FORMATTER.format(value);
}

function setStatus(message, isError = false) {
  elements.sheetStatus.textContent = message;
  elements.sheetStatus.style.color = isError ? "var(--danger)" : "";
}

function setSheetHelp(message, isError = false) {
  elements.sheetHelp.textContent = message;
  elements.sheetHelp.style.color = isError ? "var(--danger)" : "";
}

function renderSummary(expenses, categoryTotals) {
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const categoryEntries = Object.entries(categoryTotals).sort((left, right) => right[1] - left[1]);
  const [topCategoryName, topCategoryValue] = categoryEntries[0] || ["-", 0];

  elements.totalSpend.textContent = formatCurrency(total);
  elements.recordCount.textContent = `${expenses.length} transactions loaded`;
  elements.topCategory.textContent = topCategoryName;
  elements.topCategoryAmount.textContent = topCategoryValue ? formatCurrency(topCategoryValue) : "No expenses yet";
}

function renderCategoryTotals(categoryTotals) {
  const entries = Object.entries(categoryTotals).sort((left, right) => right[1] - left[1]);

  if (!entries.length) {
    elements.categoryTotals.innerHTML = '<div class="placeholder-row">No category totals available yet.</div>';
    return;
  }

  elements.categoryTotals.innerHTML = entries
    .map(([category, amount]) => {
      return `
        <div class="total-item">
          <span>${category}</span>
          <strong>${formatCurrency(amount)}</strong>
        </div>
      `;
    })
    .join("");
}

function renderTable(expenses) {
  if (!expenses.length) {
    elements.expenseTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="placeholder-row">No expense rows found.</td>
      </tr>
    `;
    return;
  }

  elements.expenseTableBody.innerHTML = expenses
    .map((expense) => {
      return `
        <tr>
          <td>${expense.date}</td>
          <td><span class="category-pill">${expense.category}</span></td>
          <td>${expense.description}</td>
          <td class="amount-cell">${formatCurrency(expense.amount)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderLegend(labels, values, colors) {
  elements.chartLegend.innerHTML = labels
    .map((label, index) => {
      return `
        <div class="legend-item">
          <div class="legend-label">
            <span class="legend-swatch" style="background:${colors[index]}"></span>
            <span>${label}</span>
          </div>
          <strong>${formatCurrency(values[index])}</strong>
        </div>
      `;
    })
    .join("");
}

function renderChart(categoryTotals) {
  const labels = Object.keys(categoryTotals);
  const values = Object.values(categoryTotals);
  const colors = labels.map((_, index) => CHART_COLORS[index % CHART_COLORS.length]);

  if (expenseChart) {
    expenseChart.destroy();
  }

  const chartContext = document.getElementById("expenseChart");

  expenseChart = new Chart(chartContext, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderColor: "#ffffff",
          borderWidth: 6,
          hoverOffset: 10,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.label}: ${formatCurrency(context.parsed)}`;
            },
          },
        },
      },
    },
  });

  renderLegend(labels, values, colors);
}

function renderDashboard(expenses) {
  allExpenses = expenses;
  const categoryTotals = summarizeByCategory(expenses);

  renderSummary(expenses, categoryTotals);
  renderCategoryTotals(categoryTotals);
  renderTable(expenses);
  renderChart(categoryTotals);
}

function openModal() {
  elements.modal.classList.remove("hidden");
  elements.modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  elements.modal.classList.add("hidden");
  elements.modal.setAttribute("aria-hidden", "true");
}

function handleExpenseSubmit(event) {
  event.preventDefault();

  const newExpense = normalizeExpense({
    date: document.getElementById("expenseDate").value,
    amount: document.getElementById("expenseAmount").value,
    category: document.getElementById("expenseCategory").value,
    description: document.getElementById("expenseDescription").value,
    source: "local",
  });

  if (!newExpense) {
    return;
  }

  const localExpenses = readLocalExpenses();
  const updatedLocalExpenses = [newExpense, ...localExpenses];
  saveLocalExpenses(updatedLocalExpenses);
  renderDashboard(combineExpenses(allExpenses.filter((expense) => expense.source === "sheet"), updatedLocalExpenses));
  elements.form.reset();
  closeModal();
  setStatus("Google Sheet synced. Local quick-add expense saved.");
}

async function initializeDashboard() {
  try {
    const [sheetResult, localExpenses] = await Promise.all([
      fetchSheetExpenses(),
      Promise.resolve(readLocalExpenses()),
    ]);

    const sheetExpenses = sheetResult.expenses;
    const combinedExpenses = combineExpenses(sheetExpenses, localExpenses);

    renderDashboard(combinedExpenses);

    if (sheetResult.state === "empty") {
      setStatus(`Spreadsheet connected, but the published tab is empty. Showing ${localExpenses.length} local entries.`, true);
      setSheetHelp("Add headers `Date`, `Amount`, `Category`, `Description` and at least one expense row to the published sheet, then reload the page.", true);
      return;
    }

    if (sheetResult.state === "invalid_headers") {
      setStatus(`Spreadsheet connected, but the ledger columns do not match the expected format. Showing ${localExpenses.length} local entries.`, true);
      setSheetHelp("The sheet must use these exact headers: `Date`, `Amount`, `Category`, `Description`.", true);
      return;
    }

    if (sheetResult.state === "unreachable") {
      setStatus("Could not read the spreadsheet service. Showing locally saved expenses only.", true);
      setSheetHelp("Check that the deployed `/api/expenses` route is live and that the Apps Script web app is still accessible.", true);
      return;
    }

    setStatus(`Connected to Google Sheets. Showing ${sheetExpenses.length} sheet rows and ${localExpenses.length} local entries.`);
    setSheetHelp("Spreadsheet data is live. New entries from the modal are stored locally in this browser until you wire a write-back flow.");
  } catch (error) {
    console.error(error);
    const localExpenses = readLocalExpenses();
    renderDashboard(localExpenses);
    setStatus("Could not reach the spreadsheet API route. Showing locally saved expenses only.", true);
    setSheetHelp("The deployment needs a working `/api/expenses` endpoint that proxies your Apps Script feed.", true);
  }
}

elements.openModalBtn.addEventListener("click", openModal);
elements.closeModalBtn.addEventListener("click", closeModal);
elements.form.addEventListener("submit", handleExpenseSubmit);

document.querySelectorAll("[data-close-modal='true']").forEach((element) => {
  element.addEventListener("click", closeModal);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal();
  }
});

initializeDashboard();
