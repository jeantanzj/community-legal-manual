const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const request = require('request');
const path = require('path');
var logger = require('winston');
logger.level = process.env.LOG_LEVEL || 'info';
var app_params = {logger:logger, request:request};
const bulkRequest = require('./bulkrequest')(app_params);
const search = require('./search')(app_params);


var HTTP_PORT = process.env.PORT || 3000;
var ENV = {'BONSAI_URL': process.env.BONSAI_URL || '' , 
	'BONSAI_USERNAME': process.env.BONSAI_USERNAME || '', 
	'BONSAI_PASSWORD': process.env.BONSAI_PASSWORD || '',
	'BONSAI_INDEX': process.env.BONSAI_INDEX || '',
	'BONSAI_DOCTYPE': process.env.BONSAI_DOCTYPE || ''};

Object.values(ENV).forEach(function(val) { 
	if(val === ''){
		logger.error('One or more environment variables for connecting to the elastic search database is missing',  ENV);
		process.exit(1);
	}
});

var site = path.join(__dirname, '_site');
var app = express();
app.use(function(request, response, next) {
    response.header('Access-Control-Allow-Origin', "*");
    response.header('Access-Control-Allow-Methods', 'GET,POST');
    response.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});	
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.use(express.static(site));
app.get('*', function(req,res) { res.sendFile('index.html', {root:site}); });

http.createServer(app)
	.listen(HTTP_PORT, function() { logger.info("Listening on port", {port: HTTP_PORT}); });


/*
* Reroute search query to elastic search 
*/
app.post('/search', function(req, res){
	var url = ENV.BONSAI_URL+'/'+ENV.BONSAI_INDEX+'/'+ENV.BONSAI_DOCTYPE+'/_search';
	var params = {'query': req.body.query, 'url': url, 'auth': btoa(ENV.BONSAI_USERNAME+':'+ENV.BONSAI_PASSWORD)};
	search.esSearch(params)
        .then((retVal) => res.send(retVal))
        .catch( (e)=> {
            var msg;
            msg = 'Error retrieving search results...';
            logger.debug(msg, e);
            res.send({error:msg});
        });
});

app.get('/search', function(req, res){
	res.send('Endpoint: POST /search');
});

/*
* Receive POST from github webhook, look for what has changed for all the commits of this push.
* Retrieve the amended md files and update elastic search.
*/
app.post('/push', function(req, res){
    var ext, bulkData, full_name, params, upsert, deletion, bulkRequestParams, error, numExpected;
    if(typeof req.body.repository == 'undefined' || typeof req.body.commits == 'undefined'){
        error = {error: 'No repository or commit information found' };
        logger.debug(error.error, req);
        res.send (error);
        return;
    }

    ext = '.md';
    bulkData = '';    

    upsert = {};
    deletion = {};
	for(let commit of req.body.commits){
       let toUpsert = bulkRequest.filteredWithExtension(commit.modified.concat(commit.added), ext);
        for(var k of toUpsert) {
            upsert[k] = 1;
        }
        let toDelete  = bulkRequest.filteredWithExtension(commit.removed, ext);
        for(let k of toDelete) {
            delete upsert[k];
            deletion[k] = 1;
        }
	}

    numExpected = {'num_deletion': Object.keys(deletion).length, 'num_upsert' : Object.keys(upsert).length};
    if ( numExpected.num_upsert== 0 && numExpected.num_deletion == 0) {
        error = { error: 'No updates made -- nothing to upsert or delete'};
        numExpected.before = req.body.before;
        numExpected.after = req.body.after;
        logger.info(error.error, numExpected);
        res.send(error);
        return;
    }

    full_name = req.body.repository.full_name;
    params = {
        url: 'https://api.github.com/repos/'+full_name+'/contents', 
        headers: { 'User-Agent' : full_name },
        timeout: 1000,
        index: ENV.BONSAI_INDEX,
        doctype: ENV.BONSAI_DOCTYPE
    };


    bulkData = bulkData + Object.keys(deletion).map(function(x) { return bulkRequest.deletionDetail(x, params);}).join('\n');
    
    Promise.all( Object.keys(upsert).map(function(x) { return bulkRequest.upsertDetail(x, params); }) )
    .then( (arr) => {
        arr = arr.filter(x=> typeof x === 'string');
        if (bulkData.length == 0 && arr.length == 0){
            error = { error: 'No updates made despite expected transactions' };
            logger.debug(error.error , numExpected);
            res.send (error);
            return;
        }
        bulkData = bulkData + '\n' + arr.join('\n');
        bulkRequestParams = {
            url: ENV.BONSAI_URL+'/'+ENV.BONSAI_INDEX+'/'+ENV.BONSAI_DOCTYPE+'/_bulk',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + btoa(ENV.BONSAI_USERNAME+':'+ENV.BONSAI_PASSWORD)
            },
            body: bulkData
        };

       return request.post(bulkRequestParams, function(error,response,body){
            if(!error && response.statusCode == 200) { 
                res.send(response); 
                return;
            }
            error = { error: 'Error posting to elastic search', statusCode: response.statusCode};
            logger.debug(error);
            res.send(error);
        });
        
    }).catch(e=> logger.debug('Error during update', e));
   
});

