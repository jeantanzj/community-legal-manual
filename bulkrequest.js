module.exports = function(app_params) { 
    const request = app_params.request;
    const logger = app_params.logger;
    filteredWithExtension = function(arr, ext){
        var ext_lc = ext.toLowerCase();
        return arr.filter(function(x) {return x.toLowerCase().endsWith(ext_lc); });
    };
    upsertDetail = function(filename, params){
        var update, doc;
        update = {};
        update.update = {};
        update.update._id = filename;
        update.update._index = params.index;
        update.update._type = params.doctype;

        doc = {};
        doc.doc = {};
        doc.doc.title = filename.replace(/\.md$/i,'').replace(/-/g,' ').replace(/(^| )(\w)/g, t => t.toUpperCase());
        doc.doc.url = doc.doc.title + '.html';
        doc.doc.content = '';
        doc.doc_as_upsert = true;


        return new Promise((resolve, reject) =>    
            {   
            console.log('upsert for: ' + filename);
            request.get({url: params.url + '/' + filename, headers: params.headers, timeout: params.timeout}, 
                function(error, response, body){
                    var result;
                    if (!error && response.statusCode == 200) { 
                        result = JSON.parse(body);
                        if (typeof result.content != 'undefined'){
                            doc.doc.content = Buffer.from(result.content,result.encoding || 'base64').toString();
                            resolve(JSON.stringify(update) + '\n' + JSON.stringify(doc));
                        }
                    }else{
                        reject({error: 'Failed to get content for ' + filename, response:response});
                    }
                }); 
            })
            .catch(e=> { logger.debug(e.error, {response: e.response}); });
       
        
    };
    deletionDetail  = function(filename,params){
        var deletion;
        deletion = {};
        deletion.delete = {};
        deletion.delete._id = filename;
        deletion.delete._index = params.index;
        deletion.delete._type = params.doctype;
        return JSON.stringify(deletion);
    };
    return {filteredWithExtension : filteredWithExtension,
            upsertDetail : upsertDetail,
            deletionDetail : deletionDetail};

};


