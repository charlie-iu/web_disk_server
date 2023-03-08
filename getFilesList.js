const express = require('express');
const { pool } = require('./db');
const { port } = require('./config');

const app = express();

app.use(express.json());

app.post('/api/getAllFiles', function (req, res) {
    const page = req.body.page || 1;
    const limit = req.body.limit || 10;
    const offset = (page - 1) * limit;

    const sqlCount = 'SELECT COUNT(*) as count FROM files';
    const sqlSelect = `SELECT * FROM files LIMIT ${limit} OFFSET ${offset}`;

    pool
        .query(sqlCount)
        .then(([rows]) => {
            const total = rows[0].count;

            pool
                .query(sqlSelect)
                .then(([rows]) => {
                    res.json({
                        total,
                        data: rows
                    });
                })
                .catch((error) => {
                    console.error(error);
                    res.status(500).send('Internal Server Error');
                });
        })
        .catch((error) => {
            console.error(error);
            res.status(500).send('Internal Server Error');
        });
});

// 启动服务器
app.listen(port, () => {
    console.log(`Server is running on port ${port}.`);
});
