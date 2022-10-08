const {
    MIME_TYPE_EPUB,
    UPLOAD_URL,
    UPLOAD_PATH
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
            // 新路径
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
        this.filename = filename //文件名
        this.path = `/book/${filename}${suffix}` //epub文件相对路径
        this.originalname = originalname //电子书原名
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
                            const coverPath = `${UPLOAD_PATH}/img/${this.filename}.${suffix}`
                            const coverUrl = `${UPLOAD_URL}/img/${this.filename}.${suffix}`
                            fs.writeFileSync(coverPath, imgBuffer, 'binary')
                            this.coverPath = `/img/${this.filename}.${suffix}`
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
        })

    }

    static genPath(path) {
        if (path.startsWith('/')) {
            return `${UPLOAD_PATH}${path}`
        } else {
            return `${UPLOAD_PATH}/${path}`
        }
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
            const filename = this.filename
            xml2js(
                xml,//目录信息
                {
                    explicitArray:false,
                    ignoreAttrs:false
                },
                function(err,json) {
                  if(err) {
                    reject(err)
                  } else {
                    const navMap = json.ncx.navMap
                    if(navMap.navPoint && navMap.navPoint.length > 0) {
                        navMap.navPoint = findParent(navMap.navPoint)
                        const newNavMap = flatten(navMap.navPoint)
                        // console.log(newNavMap === navMap.navPoint);
                        const chapters = []
                        newNavMap.forEach((chapter,index) => {
                            const src = chapter.content['$'].src
                            
                            chapter.text = `${UPLOAD_URL}${dir}/${src}`

                            chapter.label = chapter.navLabel.text || ''
                            chapter.navId = chapter['$'].id
                            chapter.filename = filename
                            chapter.order = index + 1
                            chapters.push(chapter)
                        })
                        // console.log(chapters);
                        const chapterTree = []
                        chapters.forEach(c => {
                            c.childern = []
                            if(c.pid === '') {
                                chapterTree.push(c)
                            } else {
                                const parent = chapters.find(_ => _.navId === c.pid)
                                parent.childern.push(c)
                            } 
                        })//变成树状结构
                        
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
}

module.exports = Book