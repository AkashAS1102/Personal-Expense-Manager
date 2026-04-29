# Personal Expense Manager

Files in this folder:

- `index.html`
- `styles.css`
- `app.js`

How it works:

- Uses a local Node server to fetch your Google Apps Script JSON feed for the browser
- Uses JavaScript `reduce()` to total expenses by category
- Renders a Chart.js donut chart
- Lets you add quick expenses with a modal form
- Saves new modal entries in `localStorage`

Apps Script source:

`https://script.google.com/macros/s/AKfycbxnJ53DMvXsxzkdkAMrtixvwODsxOjQJar-sakGPW-7foi_mGVvRsFlfWSkaApmxJTm/exec`

Note:

This Apps Script endpoint responded with HTTP `200` on April 29, 2026. If the dashboard shows zero rows, check whether the spreadsheet currently contains ledger data with these headers:

- `Date`
- `Amount`
- `Category`
- `Description`

Current Apps Script check:

On April 29, 2026, the Apps Script endpoint returned `{"state":"empty","rows":[]}`, so the connection is working but there are no ledger rows available yet.

To run locally:

```powershell
cd "C:\Users\akash\Desktop\codex\3. Personal Expense Manager"
node server.js
```

Then open:

`http://localhost:8080`

Why `node server.js` matters:

The local server adds a same-origin `/api/expenses` bridge so the dashboard can load your Apps Script spreadsheet data reliably from the browser.
