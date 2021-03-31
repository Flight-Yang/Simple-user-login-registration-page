var http = require('http')
var fs = require('fs')
var url = require('url')
const { join } = require('path')
const { Session } = require('inspector')
var port = process.argv[2]

if (!port) {
  console.log('请指定端口号好不啦？\nnode server.js 8888 这样不会吗？')
  process.exit(1)
}

var server = http.createServer(function (request, response) {
  var parsedUrl = url.parse(request.url, true)
  var pathWithQuery = request.url
  var queryString = ''
  if (pathWithQuery.indexOf('?') >= 0) { queryString = pathWithQuery.substring(pathWithQuery.indexOf('?')) }
  var path = parsedUrl.pathname
  var query = parsedUrl.query
  var method = request.method

  /******** 从这里开始看，上面不要看 ************/
  const session = JSON.parse(fs.readFileSync('./session.json').toString());

  console.log('有个傻子发请求过来啦！路径（带查询参数）为：' + pathWithQuery)

  if (path === '/sign_in' && method === 'POST') {
    //先设置好响应请求的反馈结果
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    const userArray = JSON.parse(fs.readFileSync("./db/users.json"));
    const array = [];
    request.on('data', (chunk) => {  //把获取到的data信息存储到array数组中
      array.push(chunk);
    });
    request.on('end', () => {
      //合成array数组的方式，因为获取到的内容是分段的，所以要合并
      const string = Buffer.concat(array).toString();
      const obj = JSON.parse(string);//得到name和password的对象 
      //新添加的find方法,如果判断用户名密码是否相同就是true,否则是undefined
      const user = userArray.find((user)=>user.name===obj.name && user.password === obj.password);
      if(user === undefined){  //当数据库里没有用户名和密码的时候
        response.statusCode = 400;
        response.setHeader("Content-Type","text/json; charset=utf-8");
        response.end(`{"errorCod":4001}`); //响应错误的信息
      }else{ //数据库有用户信息，并且匹配上

        //这里有个问题，就是session和加密也没什么不一样，但唯独可以设置过期时间，
        //当一段时间过后,再次登录，产生的随机数会更改，那么上次的加密随机数sessionId就改变了

        response.statusCode = 200;
        const random = Math.random(); //产生cookie的随机值
        session[random] = {user_id:user.id};//产生的随机数random的session对应于上面读取到的用户的ID
        fs.writeFileSync('./session.json',JSON.stringify(session)); //然后把session的信息（包括产生的随机数和用户名对应的useId）重写到session.json库中
        //设置HttpOnly是为了防止前端操作cookie,把cookie返回给前端，让页面带上cookie
        response.setHeader('Set-Cookie',`session_id=${random}; HttpOnly`);
      }
      response.end();//先end,然后才执行end的逻辑
      
    });
  } else if (path === '/home.html') { //如果已经跳转到用户页面
    
    const cookie = request.headers["cookie"]; //先读取跳转前的页面是否带有cookie
    let sessionId; //读取sessionId,获取里面用户的userID信息
    try { //捕获异常，从cookie里面分裂出对应的随机数ID,如果有就赋值给sessionId身上，如果没有就啥也不做
      sessionId =  cookie.split(';').filter(s=>s.indexOf('session_id=')>=0)[0].split('=')[1];
    } catch (error) { }

    if(sessionId && session[sessionId]){ //如果有sessionID并且session.json库里有对应的随机数才能执行下面逻辑
      const userId = session[sessionId].user_id; //把读取到的随机数ID，在对应的session.json库中找到对应的用户id
      const userArray = JSON.parse(fs.readFileSync("./db/users.json"));//读取真正数据库里的用户ID,里面对应着用户名和密码
      const user = userArray.find(user=>user.id === userId); //比对从数据库里得到的userId,有的话下面的判断逻辑里就有用户信息
      const homeHtml = fs.readFileSync("./public/home.html").toString();//读取home.html上的信息，为下面的占位符替换用户名做铺垫
      let string ='';
      if(user){   //如果用户名存在,就把user.name换成用户的名字
         string = homeHtml.replace('{{loginStatus}}','已登录').replace('{{user.name}}',user.name);
      }
      response.write(string);

    }else{ //不存在就显示空字符串
      const homeHtml = fs.readFileSync("./public/home.html").toString();
      const string = homeHtml.replace('{{loginStatus}}','未登录').replace('{{user.name}}','');;
      response.write(string);
    }
  
    response.end();

  } else if (path === "/register" && method === "POST") {
    //先设置好响应请求的反馈结果
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    const userArray = JSON.parse(fs.readFileSync("./db/users.json"));
    const array = [];
    request.on('data', (chunk) => {
      array.push(chunk);
    });
    request.on('end', () => {
      //合成array数组的方式，因为获取到的内容是分段的，所以要合并
      const string = Buffer.concat(array).toString();
      const obj = JSON.parse(string);
      //读取数据库里文件的最后一个字符串
      const lastUser = userArray[userArray.length - 1];
      const newUser = {
        id: lastUser ? lastUser.id + 1 : 1,
        name: obj.name,
        password: obj.password
      };
      userArray.push(newUser);
      fs.writeFileSync('./db/users.json', JSON.stringify(userArray));
      response.end();
    });
  } else {
    response.statusCode = 200
    //默认首页
    const filePath = path === '/' ? '/index.html' : path;
    const index = filePath.lastIndexOf('.');
    //suffix 是后缀 获取 .后面的文本标签
    const suffix = filePath.substring(index);
    console.log(suffix);
    //转换.内容
    const fileTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.png': 'image/png',
      '.jpg': 'image/jpeg'
    }
    //把后缀转换为对应后缀,如果转换内容里没有,有个保底值html
    response.setHeader('Content-Type', `${fileTypes[suffix] || 'text/html'}; charset=utf-8`);
    let content;
    //如果文件不存在,用try,catch捕获错误
    try {
      content = fs.readFileSync(`./public${filePath}`)
    } catch (error) {
      content = '文件不存在';
      response.statusCode = 404
    }
    response.write(content);
    response.end();
  }



  /******** 代码结束，下面不要看 ************/
})

server.listen(port)
console.log('监听 ' + port + ' 成功\n请用在空中转体720度然后用电饭煲打开 http://localhost:' + port)

