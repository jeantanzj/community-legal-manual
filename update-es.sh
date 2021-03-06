#!/bin/sh

#git push && ./update-es.sh
#This script uploads all the md files to the Elastic Search server at $BONSAI_URL, index 'probono', type 'md'
export BONSAI_URL=''
export BONSAI_INDEX='probono'
export BONSAI_TYPE='md'
shopt -s nullglob
MARKDOWN_FILES=('*.md')
TEMP='UPDATE-ES.tmp'

jsonEscape () {
	#alternative to replacing \n with \\n would be ` awk 1 ORS='\\n' `
	#replace \ or # or * with nothing, replace / with \/, replace " with \"
	local retVal=$(echo "$1" | tr '\n\t' ' ' | \
	sed -e 's/[\\|\#|\*]//g' \
		-e 's/\//\\\//g' \
		-e 's/\"/\\\"/g' )
	echo "$retVal"
	
}


deleteTempIfExists () {
	if [ -f $TEMP ] ; then
    	rm $TEMP
	fi
}

deleteTempIfExists

for filename in ${MARKDOWN_FILES[@]}; do
 	title="$(echo $filename | awk '{gsub(".md$",""); gsub("-", " "); for(i=1;i<=NF;i++){ $i=toupper(substr($i,1,1)) substr($i,2) }; print;}')"
 	url="$(echo $filename | awk '{c=$0; sub(".md$","",c); printf "%s.html" , c;}')"
 	escapedTitle=$(jsonEscape "$title")
 	content="$(cat $filename)"
 	escapedContent=$(jsonEscape "$content")
 	printf '{"index":{"_id":"%s"}}\n{"title":"%s", "url":"%s", "content":"%s", "docAsUpsert":true}\n' "$filename" "$escapedTitle" "$url" "$escapedContent" >> "$TEMP"
done

echo 'The path $BONSAI_URL is:'"$BONSAI_URL"
echo '\nDelete index if it exists\n'
curl -XDELETE "$BONSAI_URL/$BONSAI_INDEX"

echo '\nCreate index\n'
curl -XPUT "$BONSAI_URL/$BONSAI_INDEX" -H 'Content-Type: application/json' -d'
{
    "settings": {
        "analysis": {
            "analyzer": {
                "lc_stem_analyzer": {
                    "type":         "custom",
                    "tokenizer":    "classic",
                    "filter":       [ "lowercase", "en_stemmer" ]
            }},
            "filter" : {
                "en_stemmer" : {
                    "type" : "stemmer",
                    "name" : "english"
                }
            }
}}}
'

echo '\nAdd type to index\n'
curl -XPUT "$BONSAI_URL/$BONSAI_INDEX/_mapping/$BONSAI_TYPE" -H 'Content-Type: application/json' -d '{"properties": {"title": {"type": "text"}, "url": {"type": "text"}, "content": {"type": "text", "term_vector" : "with_positions_offsets", "analyzer":"lc_stem_analyzer"} } } '

echo '\nBulk insert the markdown files\n'
curl -XPOST "$BONSAI_URL/$BONSAI_INDEX/$BONSAI_TYPE/_bulk?pretty" --data-binary @"$TEMP" -H 'Content-Type: application/json'

deleteTempIfExists