const Book =require('../models/Book')
const db = require('../db')
const _ = require('lodash')

//判断电子书是否存在
function exists(book) {
  const {title, author, publisher} = book
  const sql = `select * from book where title='${title}' and author='${author}' and publisher='${publisher}'`
  return db.queryOne(sql)
}

// 移除电子书 
async function removeBook(book) {
 if(book) {
  console.log(book.fileName,book.author,book.bookId,book.title);
  // 删除文件夹内的电子书
  book.reset()
  // 删除数据库内的电子书
  if (book.fileName) {
    // const result = await exists(book)
    // console.log(result);
    const removeBook = `delete from book where fileName='${book.fileName}'`
    const removeContents = `delete from contents where fileName='${book.fileName}'`
    await db.querySql(removeBook)
    await db.querySql(removeContents)
  }
 }
 
}

// 添加电子书目录到数据库contents表
async function insertContents(book) {
   const contents = book.getContents()
   if(!contents) {
    const newBook = await book.parse()
    contents = newBook.getContents()
   }
  //  console.log('contents',contents);
   if(contents && contents.length > 0) {
    for(let i = 0; i < contents.length; i++) {
      const content = contents[i]
      //需要插入数据库的字段
      const _content = _.pick(content,[
        'fileName',
        'text',
        'id',
        'href',
        'order',
        'level',
        'label',
        'pid',
        'navId'
      ])
    await db.insert(_content,'contents')
    }
   }
}


//添加电子书到数据库book表
function insertBook(book) {
  return new Promise(async (resolve,reject) => {
    try {
       if (book instanceof Book) {
         const result =await exists(book)
         if(result) {
           await removeBook(book)

           reject(new Error ('电子书已存在'))
         } else {
           await db.insert(book.toDb(),'book')
           await insertContents(book)
           resolve()
         }
       } else {
         reject(new Error('添加的图书对象不合法'))
       }
    } catch(e) {

    }
    
  }) 
}

function getBook(fileName) {
  return new Promise( async (resolve,reject) => {
    try {
     const bookSql = `select * from book where fileName='${fileName}'`
     const contentSql = `select * from contents where fileName='${fileName}' order by \`order\``
     const book = await db.queryOne(bookSql)
     const contents = await db.querySql(contentSql)
     if(book) {
      book.cover = Book.genCoverUrl(book)
      book.contentsTree = Book.genContentsTree(contents)
     }
     resolve(book)
     
    } catch(e) {
      reject(new Error('电子书不存在'))
    }
  })
}

//更新电子书
function updateBook(book) {
  return new Promise(async (resolve,reject) => {
    try {
      if(book instanceof Book) {
        const result = await getBook(book.fileName)
        if(result) {
          const model = book.toDb()
          if(+result.updateType === 0) {
           reject(new Error('内置图书不可修改'))
          } else {
            await db.update(model, 'book', `where fileName='${book.fileName}'`)
            resolve()
          }
        }  else {
          reject(new Error('电子书不存在'))
        }
      } else {
        reject(new Error('添加的图书对象不合法'))
      }
    } catch(e) {
      reject(e)
    }
  })
}

module.exports = {
  insertBook,
  getBook,
  updateBook
}