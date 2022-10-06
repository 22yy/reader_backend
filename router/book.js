const express = require('express')
const multer = require('multer')
const { UPLOAD_PATH } = require('../utils/constant')
const Result = require('../models/Result')
const Book = require('../models/Book')
const boom = require('boom')

const router = express.Router()

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
                    console.log('book', book);
                    new Result(book, '电子书上传成功').success(res)
                })
                .catch(err => {
                  next(boom.badImplementation(err))
                })
        }
    }
)


module.exports = router