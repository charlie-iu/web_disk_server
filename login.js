const express = require('express');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// 创建MySQL连接
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'xxxxxx',
    database: 'web_disk'
});

// 创建Express实例
const app = express();

// 处理POST请求体
app.use(express.json());

// 设置允许跨域
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});


// 注册接口
app.post('/api/register', (req, res) => {
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
app.post('/api/login', (req, res) => {
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
            const token = jwt.sign({ userId: user.id }, 'web_disk');

            res.send(`{"code": 0, "message":"登录成功！", "token": "${token}"}`);
        });
    });
});

// 监听3000端口
app.listen(3000, () => {
    console.log('服务器已启动');
});
