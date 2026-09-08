const { database } = require('./db.cjs');
const { HttpError } = require('./errors.cjs');

async function listPets(userId) {
  const { rows } = await database().query('SELECT data FROM pets WHERE user_id=$1 ORDER BY created_at DESC,id DESC', [userId]);
  return rows.map((row) => row.data);
}
async function ownedPet(userId, id) {
  const { rows } = await database().query('SELECT data,version FROM pets WHERE id=$1 AND user_id=$2', [id, userId]);
  if (!rows[0]) throw new HttpError(404, 'Not found');
  return { archive: rows[0].data, version: rows[0].version };
}
async function insertPet(archive) {
  await database().query('INSERT INTO pets(id,user_id,data) VALUES($1,$2,$3)', [archive.id, archive.ownerId, archive]);
}
async function updatePet(userId, id, version, archive) {
  const { rowCount } = await database().query('UPDATE pets SET data=$1,version=version+1 WHERE id=$2 AND user_id=$3 AND version=$4', [archive, id, userId, version]);
  // 不覆盖另一个请求刚保存的形态或统计，客户端刷新后再编辑。
  if (!rowCount) throw new HttpError(409, '档案已被更新，请刷新后重试');
}
async function deletePet(userId, id) {
  const { rows } = await database().query('DELETE FROM pets WHERE id=$1 AND user_id=$2 RETURNING data', [id, userId]);
  if (!rows[0]) throw new HttpError(404, 'Not found');
  // 素材保留用于恢复；不在 HTTP 请求中批量删除文件。
  return rows[0].data;
}
async function ownsVideo(userId, url) {
  const { rows } = await database().query("SELECT 1 FROM pets WHERE user_id=$1 AND data->'results' @> $2::jsonb LIMIT 1", [userId, JSON.stringify([{ videoUrl: url }])]);
  return rows.length > 0;
}
async function ownsImage(userId, url) {
  const { rows } = await database().query("SELECT 1 FROM pets WHERE user_id=$1 AND data->'results' @> $2::jsonb LIMIT 1", [userId, JSON.stringify([{ imageUrl: url }])]);
  return rows.length > 0;
}
module.exports = { listPets, ownedPet, insertPet, updatePet, deletePet, ownsVideo, ownsImage };
