const express = require('express');
const router = express.Router();
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const Path = require('path');
const fs = require('fs');
const { secret } = require('./config');
const Query = require('./db');
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// 解析POST请求的请求体
app.use(bodyParser.json());




// 注册接口
router.post('/register', (req, res) => {
    // 从请求体中获取用户名、密码和昵称
    const { username, password, nickname } = req.body;

    // 查询用户名是否已存在
    Query(`SELECT COUNT(*) as COUNT FROM users WHERE username='${username}'`, (err, result) => {
        if (err) {
            res.status(500).send(`{"code": 3, "message":"Internal server error"}`);
            return;
        }

        if (result[0].COUNT > 0) {
            res.status(409).send(`{"code": 4, "message":"用户名已存在"}`);
            return;
        }

        // 加密密码
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) {
                res.status(500).send('{"code": 2, "message":"Internal server error"}');
                return;
            }

            // 插入用户信息到数据库
            Query(`INSERT INTO users (username, password, nickname) VALUES ('${username}', '${hash}', '${nickname}')`, (err, result) => {
                if (err) {
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
    Query("SELECT * FROM users WHERE username = ? ", [username], (err, result) => {
        if (err) {
            res.status(500).send(`{"code": 3, "message":"Internal server error"}:`);
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

// 退出登录接口
router.post('/logout', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).send('无效token');
    }

    try {
        const decodedToken = jwt.verify(token, secret);

        // 查询用户信息
        Query(`SELECT * FROM users WHERE id='?'`, [decodedToken.userId], (err, result) => {
            if (err) {
                return res.status(500).send('Internal server error');
            }

            if (result.length === 0) {
                return res.status(401).send('用户不存在');
            }

            // 在这里执行退出登录操作
            res.send({ code: 0, message: '退出登录成功', data: null });
        });
    } catch (error) {
        return res.status(401).send('无效的token');
    }
});

// 上传前告诉前端上传路径
const dir = 'D:\\uploads';

// 上传接口
// 检查目录是否存在，如果不存在就创建目录
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, (err) => {
        if (err) {
            console.error(err);
        } else {
            console.log('创建文件夹成功');
        }
    });
}

if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

// 配置multer上传中间件
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, dir); // 指定上传文件的存储路径
    },
    filename: (req, file, cb) => { // 修改为filename
        cb(null, file.originalname); // 将文件名传递给回调函数
    },
});
const upload = multer({ storage });

// 接收文件上传请求
router.post('/upload', upload.single('file'), (req, res) => {
    try {
        // 从 HTTP 请求的头部 Authorization 字段中获取 token
        const token = req.headers.authorization.split(' ')[1];
        if (!token) {
            res.status(401).send('No token');
            return;
        }
        // 解析 token，获取 payload
        const payload = jwt.verify(token, secret);
        // 从 payload 中获取用户 id
        const userId = payload.userId;
        // 将文件信息保存到数据库中
        const { filename, size, path, mimetype } = req.file;

        const user_id = userId; // 获取上传文件的用户id
        const fileId = uuidv4(); // 生成随机的uuid
        const insertSql = 'INSERT INTO files (id, user_id, name, size, type, path) VALUES (?, ?, ?, ?, ?, ?)';
        const values = [fileId, user_id, filename, size, mimetype, Path.relative(dir, path)];
        Query(insertSql, values, (err, result) => {
            if (err) {
                res.status(500).send('Internal Server Error')
            }
            const selectSql = 'SELECT * FROM files WHERE id = ?';
            const selectValues = [fileId];
            Query(selectSql, selectValues, (err, result) => {
                if (err) {
                    res.status(500).send('Internal Server Error')
                }
                if (result.length > 0) {
                    res.status(200).json(result[0]);
                } else {
                    res.status(404).json({ message: '文件不存在' });
                }
            });
        });

    } catch (error) {
        res.status(500).json({ message: '上传文件失败' });
    }
});

// 错误处理中间件
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // multer 错误处理
        res.status(400).json({ message: '上传文件失败' });
    } else {
        next(err);
    }
});
// 其他错误处理中间件
app.use((err, req, res, next) => {
    res.status(500).json({ message: 'Internal server error' });
});


// 获取所有文件接口
router.post('/getAllFiles', function (req, res) {
    const page = req.body.page || 1;
    const limit = req.body.limit || 10;
    const offset = (page - 1) * limit;

    const sqlCount = 'SELECT COUNT(*) as count FROM files';
    const sqlSelect = `SELECT * FROM files LIMIT ${limit} OFFSET ${offset}`;
    Query(sqlCount, null, (err, result1) => {
        if (err) {
            return res.status(500).send('Internal server error');
        }
        const total = result1[0].count;
        Query(sqlSelect, null, (err, result2) => {
            if (err) {
                return res.status(500).send('Internal server error');
            }
            res.status(200).json({
                code: 0,
                total,
                data: result2
            })
        })

    })
});

// 下载
router.get('/download/:id', (req, res) => {
    try {
        const fileId = req.params.id;
        Query('SELECT name FROM files WHERE id = ?', [fileId], (err, result) => {
            // 单独下载
            if (result && result.length === 1) {
                const fileName = result[0].name;
                const fileStream = fs.createReadStream(`${dir}/${fileName}`);
                res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
                res.download(`${dir}/${fileName}`, fileName);
            }
        });
    } catch (err) {
        res.status(500).send('Internal server error');
    }
});

// 删除
router.post('/delete', (req, res) => {
    const id = req.body.id;
    // 从数据库中查询要删除的文件信息
    Query('SELECT * FROM files WHERE id = ?', [id], (err, results) => {
        if (err) {
            res.status(500).json({ error: 'Internal server error' });
            return;
        }

        // 如果找到了要删除的文件，则将其从数据库中删除
        if (results.length > 0) {
            Query('DELETE FROM files WHERE id = ?', [id], (err, results) => {
                console.log(results);
                if (err) {
                    res.status(500).json({ error: 'Internal server error' });
                    return;
                }
                res.status(200).json({ code: 0, message: 'done' });
            });
        } else {
            res.status(404).json({ error: 'File not found' }); // 返回404状态码表示没有找到要删除的文件
        }
    });
});

// 重命名
router.post('/rename', (req, res) => {
    const {id, newName} = req.body;
    Query('SELECT * FROM files WHERE id = ?', [id], (err, result) => {
        if (err) {
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
        const fileName = result[0].name;
        const fileExtension = fileName.split('.').pop();

        if(result.length > 0) {
            Query('UPDATE files SET name = ? WHERE id = ?;', [newName + '.' + fileExtension, id], (err, result2) => {
                if (err) {
                    res.status(500).json({ error: 'Internal server error' });
                    return;
                }
                res.status(200).json({code: 0, message: '重命名成功！'});
            });
        } else {
            res.status(404).send('404 Not Found');
        }
    });
});

// 查询图片类型
router.post('/pic', (req, res) => {
    Query('SELECT * FROM files WHERE type LIKE "image/%"', [], (err, result) => {
        if (err) {
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
        if (result) {
            res.status(200).json({ code: 0, data: result });
        }
    })
});

// 查询文档
router.post('/text', (req, res) => {
    Query('SELECT * FROM files WHERE type LIKE "text/%" OR type LIKE "application/%"', [], (err, result) => {
        if (err) {
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
        if (result > 0) {
            res.status(200).json({ code: 0, data: result })
        }
    })
});

// 查询音视频
router.post('/media', (req, res) => {
    Query('SELECT * FROM files WHERE type LIKE "video/%" OR type LIKE "audio/%"', [], (err, result) => {
        if (err) {
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
        if (result > 0) {
            res.status(200).json({ code: 0, data: result })
        }
    })
});



module.exports = router;


