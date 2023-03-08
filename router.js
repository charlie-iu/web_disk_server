const express = require('express');
const router = express.Router();
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const Path = require('path');
const fs = require('fs');
const uuid = require('uuid');
const { secret } = require('./config');
const { pool } = require('./db');


// 创建MySQL连接
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'web_disk'
});


// 注册接口
router.post('/register', (req, res) => {
    // 从请求体中获取用户名、密码和昵称
    const { username, password, nickname } = req.body;

    // 查询用户名是否已存在
    connection.query(`SELECT COUNT(*) as COUNT FROM users WHERE username='${username}'`, (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send(`{"code": 3, "message":"服务器错误"}`);
            return;
        }

        if (result[0].count > 0) {
            res.status(400).send('用户名已存在');
            return;
        }

        // 加密密码
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) {
                console.error(err);
                res.status(500).send('{"code": 2, "message":"服务器错误"}');
                return;
            }

            // 插入用户信息到数据库
            connection.query(`INSERT INTO users (username, password, nickname) VALUES ('${username}', '${hash}', '${nickname}')`, (err, result) => {
                if (err) {
                    console.error(err);
                    res.status(500).send(`{"code": 1, "message":"${err.sqlMessage}"}`);
                    return;
                }

                res.send('{"code": 0, "message":"注册成功！"}');
            });
        });
    });
});

// 登录接口
router.post('/login', (req, res) => {
    // 从请求体中获取用户名和密码
    const { username, password } = req.body;

    // 查询用户信息
    connection.query(`SELECT * FROM users WHERE username='${username}'`, (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send(`{"code": 3, "message":"服务器错误"}:`);
            return;
        }

        if (result.length === 0) {
            res.status(401).send('用户名不存在');
            return;
        }

        const user = result[0];

        // 比较密码
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                console.error(err);
                res.status(500).send(`比较密码出错:`);
                return;
            }

            if (!isMatch) {
                res.status(401).send('密码错误');
                return;
            }

            // 生成JWT
            const token = jwt.sign({ userId: user.id }, secret);

            res.send(`{"code": 0, "message":"登录成功！", "token": "${token}"}`);
        });
    });
});

// 上传接口
// 检查目录是否存在，如果不存在就创建目录
const dir = './upload';
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, (err) => {
        if (err) {
            console.error(err);
        } else {
            console.log('创建文件夹成功');
        }
    });
}

console.log('目录是否存在：', fs.existsSync(dir));
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

// 配置multer上传中间件
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, Path.join(__dirname, dir)); // 指定上传文件的存储路径
    },
    filename: (req, file, cb) => { // 修改为filename
        const extname = Path.extname(file.originalname); // 获取上传文件的扩展名
        const name = uuid.v4() + extname; // 使用uuid生成唯一的文件名
        cb(null, name); // 将文件名传递给回调函数
    },
});
const upload = multer({ storage });

// 接收文件上传请求
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        // 从 HTTP 请求的头部 Authorization 字段中获取 token
        const token = req.headers.authorization.split(' ')[1];
        // 解析 token，获取 payload
        const payload = jwt.verify(token, secret);
        // 从 payload 中获取用户 id
        const userId = payload.userId;
        // 将文件信息保存到数据库中
        const { originalname, size, path, mimetype } = req.file;

        const user_id = userId; // 获取上传文件的用户id
        const insertSql = 'INSERT INTO files (user_id, name, size, type, path) VALUES (?, ?, ?, ?, ?)';
        const values = [user_id, originalname, size, mimetype, Path.relative(__dirname, path)];
        const [result] = await pool.query(insertSql, values);
        const fileId = result.insertId;
        console.log('fileId', fileId);
        const selectSql = 'SELECT * FROM files WHERE id = ?';
        const selectValues = [fileId];
        const fileResult = await pool.query(selectSql, selectValues);

        if (fileResult[0] && fileResult[0].length > 0) {
            res.json(fileResult[0]);;
            console.log('文件上传成功', fileResult[0])
        } else {
            console.log('失败');
            res.status(404).json({ message: '文件不存在' });
        }


    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '上传文件失败' });
    }
});

// 获取所有文件接口
router.post('/getAllFiles', function (req, res) {
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

module.exports = router;


