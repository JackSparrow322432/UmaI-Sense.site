// Выполнить ОДИН раз на data1 после запуска MongoDB на всех трёх узлах:
//   docker compose exec mongo mongosh -u $MONGO_ROOT_USER -p $MONGO_ROOT_PASSWORD --authenticationDatabase admin /init/init-replica-set.js
// (или вставить содержимое в mongosh)
rs.initiate({
  _id: 'rs0',
  members: [
    { _id: 0, host: '10.10.0.11:27017', priority: 2 },
    { _id: 1, host: '10.10.0.12:27017', priority: 1 },
    { _id: 2, host: '10.10.0.13:27017', priority: 1 },
  ],
});

// Через ~20 секунд, на PRIMARY: пользователь приложения с правами только на свою базу
// db.getSiblingDB('admin').createUser({
//   user: 'umaisense',
//   pwd: 'СГЕНЕРИРОВАТЬ',
//   roles: [{ role: 'readWrite', db: 'umai_sense' }],
// });
// Пользователь для бэкапов:
// db.getSiblingDB('admin').createUser({ user: 'backup', pwd: 'СГЕНЕРИРОВАТЬ', roles: ['backup'] });
