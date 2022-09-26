const express = require("express")
const router = require('./router')
    // body-parser解决req.body获取post请求参数undefined问题
const bodyParser = require('body-parser')
    //解决跨域
const cors = require('cors')

//创建express应用 
const app = express()

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

app.use(cors())

//监听/路径的get请求 
app.use('/', router)

// 使 express 监听 5000 端口号发起的 http 请求
const server = app.listen(18082, function() {
    const { port } = server.address()
    console.log('Http Server is running on http://localhost:%s', port)
})