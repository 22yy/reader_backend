const Book =require('../models/Book')
const db = require('../db')
const _ = require('lodash')
const { debug } = require('../utils/constant')

//判断电子书是否存在
function exists(book) {
  const {title, author, publisher} = book
  const sql = `select * from book where title='${title}' and author='${author}' and publisher='${publisher}'`
  return db.queryOne(sql)
}

// 移除电子书 
async function removeBook(book) {
 if(book) {
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

// 获取数据库中的电子书
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

// 获取分类
async function getCategory() {
 const sql = 'select * from category order by category asc'
 const result = await db.querySql(sql)
//  console.log(result);
 const categoryList = []
 result.forEach(item => {
  categoryList.push({
    label: item.categoryText ,
    value: item.category,
    num: item.num
  })
 })
 return categoryList
}

//获取电子书列表
async function listBook(query) {
  debug && console.log('query',query);
  const { 
    category, 
    author, 
    title, 
    page=1, 
    sort,
    pageSize=20 } = query
  const offset= (page - 1)*pageSize
  let bookSql = 'select * from book'
  let where = 'where'

  //生成模糊查询sql语句
  title && (where = db.andLike(where, 'title', title))
  author && (where = db.andLike(where, 'author', author))
  category && (where = db.and(where, 'categoryText', category))
  if (where !== 'where') {
    bookSql = `${bookSql} ${where}`
  }
  // 生成排序sql语句
  if(sort) {
    const symbol = sort[0]
    const column = sort.slice(1,sort.length)
    const order = symbol === '+' ? 'asc' : 'desc'
    bookSql = `${bookSql} order by \`${column}\` ${order}`
  }
  //limit y offset x 表示: 跳过 x 条数据，读取 y 条数据
  bookSql = `${bookSql} limit ${pageSize} offset ${offset}`

  // 查询结果的个数
  let countSql = 'select count(*) as count from book'
  if(where !== 'where') {
    countSql = `${countSql} ${where}`
  }
  const count = await db.querySql(countSql)
  
  debug && console.log('countSql',countSql);
  debug && console.log('bookSql',bookSql);

  const list =await db.querySql(bookSql)
  
  // 生成完整的封面路径
  list.forEach(book => book.cover = Book.genCoverUrl(book))

  return {list, count:count[0].count, page, pageSize}
  // async函数返回的内容会自动转换为promise
}

//删除电子书
function deleteBook(fileName) {
  return new Promise( async (resolve, reject) => {
    let book = await getBook(fileName)
    if(book) {
      if(+book.updateType === 0) {
        reject(new Error('内置电子书不能删除'))
      } else {
        const bookObj = new Book(null, book)
        const sql = `delete from book where fileName='${fileName}'`
        debug && console.log('deleteSql',sql);
        db.querySql(sql).then(() => {
          bookObj.reset()
          resolve()
        })
      }
    } else {
      reject(new Error('电子书不存在'))
    }
  })
}

module.exports = {
  insertBook,
  getBook,
  updateBook,
  getCategory,
  listBook,
  deleteBook
}