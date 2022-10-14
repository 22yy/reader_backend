const express = require('express')
const multer = require('multer')
const { UPLOAD_PATH } = require('../utils/constant')
const Result = require('../models/Result')
const Book = require('../models/Book')
const boom = require('boom')
const {decode} = require('../utils/index')
const bookService  = require('../service/book')

const router = express.Router()

// 图书上传接口
router.post('/upload',
    multer({ dest: `${UPLOAD_PATH}/book` }).single('file'),
    function(req, res, next) {
        if (!req.file && req.file.length === 0) {
            new Result(null,'上传电子书失败').fail(res)
        } else {
            const book = new Book(req.file)
            // console.log(book);
            // console.log(req.file);
            book.parse()
                .then(book => {
                    new Result(book, '电子书上传成功').success(res)
                })
                .catch(err => {
                  next(boom.badImplementation(err))
                })
        }
    }
)

// 添加电子书到数据库
router.post('/create',
  function(req, res, next) {
   const decoded = decode(req)
   if(decoded && decoded.username) {
     req.body.username = decoded.username
   }
     const book = new Book(null, req.body)
     bookService.insertBook(book).then(()=> {
       new Result('添加电子书成功').success(res)
     }).catch(err => {
        console.log('/book/create',err);
        next(boom.badImplementation(err))
     })
 }
)

//获取存在的电子书信息
router.get('/get',
function(req,res,next) {
  const {fileName} = req.query
  if(!fileName) {
   next(boom.badRequest(new Error('参数fileName不能为空')))
  } else {
    bookService.getBook(fileName).then(book => {
      // console.log('book',book);
      new Result(book,'获取电子书信息成功').success(res)
    }).catch(err => {
      next(boom.badImplementation(err))
    })
  }
  
})


module.exports = router