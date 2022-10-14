const {
    MIME_TYPE_EPUB,
    UPLOAD_URL,
    UPLOAD_PATH,
    OLD_UPLOAD_URL
} = require('../utils/constant')
const fs = require('fs')
const EPub = require('../utils/epub')
const xml2js = require('xml2js').parseString
const path = require('path')


class Book {
    constructor(file, data) {
        if (file) {
            this.createFromFile(file)
        } else {
            this.createFromData(data)
        }
    }
    createFromFile(file) {
        // console.log('createFromFile', file);
        const {
            destination: des, // 文件本地存储目录
            filename, // 文件名称
            mimetype = MIME_TYPE_EPUB, // 文件资源类型
            path,
            originalname
        } = file
        // 后缀名
        const suffix = mimetype === MIME_TYPE_EPUB ? '.epub' : ''
            // 原有路径
        const oldBookPath = `${des}/${filename}`
            // 新路径,加后缀
        const bookPath = `${des}/${filename}${suffix}`
            // 电子书下载URL链接
        const url = `${UPLOAD_URL}/book/${filename}${suffix}`
            // 解压后文件夹路径
        const unzipPath = `${UPLOAD_PATH}/unzip/${filename}`
            // 解压后文件夹URL
        const unzipUrl = `${UPLOAD_URL}/unzip/${filename}`
        if (!fs.existsSync(unzipPath)) {
            fs.mkdirSync(unzipPath, { recursive: true })
        }
        //重命名文件
        if (fs.existsSync(oldBookPath) && !fs.existsSync(bookPath)) {
            fs.renameSync(oldBookPath, bookPath)
        }
        //book对象
        this.fileName = filename //文件名
        this.path = `/book/${filename}${suffix}` //epub文件相对路径
        this.originalName = originalname //电子书原名
        this.filePath = this.path
        this.unzipPath = `/unzip/${filename}`
        this.url = url
        this.title = ''
        this.author = ''
        this.publisher = ''
        this.contents = [] //目录
        this.cover = ''
        this.coverPath='' //封面图片路径
        this.category = -1 //分类id
        this.categoryText = ''
        this.language = ''
        this.unzipUrl = unzipUrl

    }
    createFromData(data) {
        // 和数据库字段映射
       this.fileName = data.fileName
       this.title = data.title
       this.author = data.author
       this.publisher = data.publisher
       this.cover = data.cover
       this.coverPath = data.coverPath
       this.bookId = data.fileName
       this.language = data.language
       this.rootFile = data.rootFile
       this.originalName = data.originalName
       this.path = data.path || data.filePath
       this.filePath = data.path || data.filePath
       this.unzipPath = data.unzipPath
       this.createUser = data.username
       this.createDt = new Date().getTime()
       this.updateDt = new Date().getTime()
       this.updateType = data.updateType === 0 ? data.updateType : 1
       this.category = data.category || 99
       this.categoryText = data.categoryText || '自定义'
       this.contents = data.contents || []
    }

    parse() {
        return new Promise((resolve, reject) => {
            const bookPath = `${UPLOAD_PATH}${this.path}`
            // console.log(bookPath);
            if (!this.path || !fs.existsSync(bookPath)) {
                reject(new Error('电子书不存在'))
            }
            const epub = new EPub(bookPath)
            epub.on('error', err => {
                reject(err)
            })
            epub.on('end', err => {
                if(err) {
                    reject(err)
                } else {
                    // console.log(epub.rootFile);
                    let {
                        title,
                        creator,
                        creatorFileAs,
                        publisher,
                        language,
                        cover
                    } = epub.metadata
                    if(!title) {
                        reject(new Error('图书标题为空'))
                    }
                    this.title = title
                    this.author = creator || creatorFileAs || 'unknown'
                    this.publisher = publisher || 'unknown'
                    this.language = language || 'en'
                    this.rootFile = epub.rootFile //'content.opf
                    const handleGetImage = ((err, imgBuffer, mimeType) => {
                        // console.log(err,imgBuffer,mimeType);
                        if(err) {
                            reject(err)
                        } else {
                            const suffix = mimeType.split('/')[1]
                            const coverPath = `${UPLOAD_PATH}/img/${this.fileName}.${suffix}`
                            const coverUrl = `${UPLOAD_URL}/img/${this.fileName}.${suffix}`
                            fs.writeFileSync(coverPath, imgBuffer, 'binary')
                            this.coverPath = `/img/${this.fileName}.${suffix}`
                            this.cover = coverUrl
                            // console.log('cover',cover);
                            resolve(this)
                        }
                    })
                    try {
                        this.unzip()
                        //解析目录
                        this.parseContents(epub).then(({chapters,chapterTree}) => {
                          this.contents = chapters
                          this.contentsTree = chapterTree
                          epub.getImage(cover, handleGetImage) //获取封面图片
                        })
                    } catch(e) {
                        reject(e)
                    }
                }
            })
            epub.parse()
            this.epub = epub
        })

    }
    
    // 解压电子书
    unzip() {
        const AdmZip = require('adm-zip')
        const zip = new AdmZip(Book.genPath(this.path)
        ) // 解析文件路径
        zip.extractAllTo(
            /*target path*/
            Book.genPath(this.unzipPath),
            /*overwrite*/
            true
        )
    }  
    
    //解析目录
    parseContents(epub) {
        function getNcxFilePath() {
          const spine = epub && epub.spine
          const manifest = epub && epub.manifest
          const ncx = spine.toc && spine.toc.href
          const id =  spine.toc && spine.toc.id
        //   console.log(ncx,manifest[id].href);
        if(ncx){
            return ncx
        }else {
            return manifest[id].href
        }
     }
       function findParent(array,level = 0,pid = '') {
           return array.map(item => {
            item.level = level
            item.pid =pid
             if(item.navPoint && item.navPoint.length >0 ) {
                item.navPoint = findParent(item.navPoint,level+1,item['$'].id)
             } else if(item.navPoint) {
                item.navPoint.level = level + 1
                item.navPoint.pid = item['$'].id
             }
             return item
           })
       }
      
       function flatten(array) {
        return [].concat(...array.map(item => {
            if(item.navPoint && item.navPoint.length) {
                return [].concat(item,...flatten(item.navPoint))
            }else if(item.navPoint) { //navPoint是一个对象
                return [].concat(item,item.navPoint)
            }
            return item
        }))
       }
      const ncxFilePath = Book.genPath(`${this.unzipPath}/${getNcxFilePath()}`)

      if(fs.existsSync(ncxFilePath)){
         return new Promise((resolve,reject) => {
            //读取目录文件toc.ncx
            const xml = fs.readFileSync(ncxFilePath,'utf-8')
            //toc.ncx所在的文件路径
            const dir = path.dirname(ncxFilePath).replace(UPLOAD_PATH,'')
            const fileName = this.fileName
            const unzipPath = this.unzipPath
             // 将ncx文件从xml转为json
            xml2js(
                xml,//目录信息
                {
                    explicitArray: false, // 设置为false时，解析结果不会包裹array
                    ignoreAttrs: false // 解析属性
                },
                function(err,json) {
                  if(err) {
                    reject(err)
                  } else {
                    const navMap = json.ncx.navMap // 获取ncx的navMap属性
                    if (navMap.navPoint && navMap.navPoint.length > 0) { // 如果navMap属性存在navPoint属性，则说明目录存在
                        navMap.navPoint = findParent(navMap.navPoint)
                        const newNavMap = flatten(navMap.navPoint)
                        // console.log(newNavMap === navMap.navPoint);
                        const chapters = []
                        newNavMap.forEach((chapter,index) => {
                            let src = chapter.content['$'].src
                            // console.log(chapter);
                            chapter.id = `${src}`
                            chapter.href = `${dir}/${src}`.replace(unzipPath,'')
                            // 发现有的本地测试用的电子书src不规范
                            if (src.startsWith('Text/OEBPS/')) {
                              src = src.replace('Text/OEBPS/','')
                              chapter.text = `${UPLOAD_URL}${dir}/${src}`
                            } else {
                              chapter.text = `${UPLOAD_URL}${dir}/${src}`
                           }
                            // console.log('dir',dir);
                            chapter.label = chapter.navLabel.text || ''  
                            chapter.navId = chapter['$'].id
                            chapter.fileName = fileName
                            chapter.order = index + 1
                            chapters.push(chapter)
                        })
                        // console.log(chapters);
                        const chapterTree = Book.genContentsTree(chapters)
                        resolve({chapters,chapterTree})
                    } else {
                       reject(new Error('目录解析失败,目录树为0'))
                    }
                  }
            })
         })
      } else {
        throw new Error('目录文件不存在')
      }
   }

   //将book数据与数据库字段映射
   toDb() {
    return {
        title: this.title,
        cover: this.cover,
        author: this.author,
        publisher: this.publisher,
        bookId: this.bookId,
        fileName: this.fileName,
        updateType: this.updateType,
        language: this.language,
        rootFile: this.rootFile,
        originalName: this.originalName,
        filePath: this.filePath,
        coverPath: this.coverPath,
        unzipPath: this.unzipPath,
        createUser: this.createUser,
        createDt: this.createDt,
        updateDt: this.updateDt,
        category: this.category || 99,
        categoryText: this.categoryText || '自定义'
    }
   }
   
//    获取目录
   getContents() {
    return this.contents
   }

//    获得完整的文件路径
  static genPath(path) {
      if (path.startsWith('/')) {
          return `${UPLOAD_PATH}${path}`
      } else {
          return `${UPLOAD_PATH}/${path}`
      }
  }

//   文件是否存在
  static pathExists(path) {
    if(path.startsWith(UPLOAD_PATH)) {
        return fs.existsSync(path)
    } else {
        return fs.existsSync(Book.genPath(path))
    }
   }

//    生成contensTree
static genContentsTree(contents) {
    const chapterTree = []
    contents.forEach(c => {
        c.childern = []
        if (c.pid === '') {
            chapterTree.push(c)
        } else {
            const parent = contents.find(_ => _.navId === c.pid)
            parent.childern.push(c)
        }
    }) 
    return chapterTree//变成树状结构
}

// 获取封面URL
static genCoverUrl(book) {
    const { cover } = book
    console.log('cover',cover);
    // 老电子书
    if(+book.updateType === 0) {
      if(cover) {
         if (cover.startsWith('/')) {
             return `${OLD_UPLOAD_URL}${cover}`
         } else {
             return `${OLD_UPLOAD_URL}/${cover}`
         }
      } else {
        return null
      }
  } else {
    if(cover) {
        if(cover.startsWith('/')) {
          return `${UPLOAD_URL}${cover}`
        } else {
          return `${cover}`
        }
    } else {
        return null
    }
  }
}
   
//    删除文件夹内的电子书
reset() {
    if (this.path && Book.pathExists(this.path)) {
        fs.unlinkSync(Book.genPath(this.path))
    }
    if (this.filePath && Book.pathExists(this.filePath)) {
        console.log('删除epub文件...');
        fs.unlinkSync(Book.genPath(this.filePath))
    }
    if (this.coverPath && Book.pathExists(this.coverPath)) {
        console.log('删除封面...');
        fs.unlinkSync(Book.genPath(this.coverPath))
    }
    if (this.unzipPath && Book.pathExists(this.unzipPath)) {
        console.log('删除文件夹...');
        // 注意node低版本将不支持第二个属性
        fs.rmdirSync(Book.genPath(this.unzipPath), {
            recursive: true
        })
    }
}
}

module.exports = Book