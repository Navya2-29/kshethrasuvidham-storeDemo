/**
 * Single-store auto-mirror.
 *
 * Some temples run a godown + several departments (Purchase/Opening/Direct
 * Entry land in the godown, Stock Transfer moves it to a department, Sales
 * sells from the department). Other temples have just one store - for them
 * the godown/department split is pure friction, since Sales can never sell
 * from the godown directly.
 *
 * Rather than changing how Purchase/Opening/Direct Entry write stock (risky -
 * that logic is already correct and well-tested for the multi-department
 * case), this mirrors every godown (MAIN_STORE) stock change into the sole
 * department's stock automatically, within the same transaction, whenever
 * exactly one active department exists. With 0 or 2+ departments this is a
 * complete no-op, so multi-department temples are unaffected.
 */

async function getSoleDepartmentId(conn) {
  const [depts] = await conn.query(
    'SELECT id FROM departments WHERE is_active = 1'
  );
  return depts.length === 1 ? depts[0].id : null;
}

/**
 * Mirrors a MAIN_STORE stock delta into the sole department's stock.
 * qty/free_qty may be negative (used for reversals/cancellations).
 */
async function mirrorToSoleDepartment(conn, product_id, qty, free_qty = 0) {
  const deptId = await getSoleDepartmentId(conn);
  if (!deptId) return;

  await conn.query(
    `INSERT INTO stock (product_id, location_type, location_id, qty, free_qty)
     VALUES (?, 'DEPARTMENT', ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       qty = GREATEST(0, qty + VALUES(qty)),
       free_qty = GREATEST(0, free_qty + VALUES(free_qty))`,
    [product_id, deptId, qty || 0, free_qty || 0]
  );
}

module.exports = { getSoleDepartmentId, mirrorToSoleDepartment };
