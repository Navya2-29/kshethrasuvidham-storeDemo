const db = require("../config/db.config");

function getMonthYear() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = String(now.getFullYear()).slice(-2);
  return month + year;
}

async function generateInvoice(prefix = "SAL", connection) {
  const monthKey = getMonthYear();

  // lock row (important)
  const [[row]] = await connection.query(
    `SELECT last_number
     FROM invoice_sequence
     WHERE prefix = ? AND month_key = ?
     FOR UPDATE`,
    [prefix, monthKey]
  );

  let nextNo = 1;

  if (row) {
    nextNo = row.last_number + 1;

    await connection.query(
      `UPDATE invoice_sequence
       SET last_number = ?
       WHERE prefix = ? AND month_key = ?`,
      [nextNo, prefix, monthKey]
    );
  } else {
    await connection.query(
      `INSERT INTO invoice_sequence (prefix, month_key, last_number)
       VALUES (?, ?, ?)`,
      [prefix, monthKey, nextNo]
    );
  }

  return `${prefix}-${nextNo}/${monthKey}`;
}

module.exports = { generateInvoice };