const express = require('express');
const multer = require('multer');
const Path = require('path');
const fs = require('fs');
const uuid = require('uuid');
const { pool } = require('./db');
const jwt = require('jsonwebtoken');
const { secret, port } = require('./config');

const app = express();

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
app.post('/api/upload', upload.single('file'), async (req, res) => {
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

// 启动服务器
app.listen(port, () => {
    console.log(`Server is running on port ${port}.`);
});