const { env } = require('./env')

const UPLOAD_PATH = env === 'dev' ? 'C:/Users/dd/upload/admin-upload-ebook' : '/root/upload/admin-upload-ebook'
const UPLOAD_URL = env === 'dev' ? 'http://localhost:8089/admin-upload-ebook' : ''

// const OLD_UPLOAD_URL = env === 'dev' ? 'http://localhost:8089/book' : ''

const OLD_UPLOAD_URL = env === 'dev' ? 'https://book.youbaobao.xyz/book/res/img': ''
    
   

module.exports = {
    CODE_ERROR: -1,
    CODE_SUCCESS: 0,
    CODE_TOKEN_EXPIRED: -2,
    debug: true,
    PWD_SALT: 'admin_imooc_node',
    PRIVATE_KEY: 'admin_imooc_node_jwt',
    JWT_EXPIRED: 60 * 60, // token失效时间
    UPLOAD_PATH,
    MIME_TYPE_EPUB: 'application/epub',
    UPLOAD_URL,
    OLD_UPLOAD_URL
}