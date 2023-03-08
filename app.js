const express = require('express');
const router = require('./router');

const app = express();
app.use(express.json());
app.use('/api', router);


// 监听3000端口
app.listen(3000, () => {
    console.log('服务器已启动');
});

