#!/bin/sh

#This script uploads all the md files to the Elastic Search server at $BONSAIURL, index 'probono', type 'md'
export BONSAIURL=https://4et5fzvqdw:5as4dekv3t@first-cluster-5446942761.ap-southeast-2.bonsaisearch.net
shopt -s nullglob
MARKDOWN_FILES=("*.md")
TEMP="UPSERTFILE.tmp"

jsonEscape () {
	#alternative to replacing \n with \\n would be ` awk 1 ORS='\\n' `
	#replace \ or # or * with nothing, replace / with \/, replace " with \"
	local retVal=$(echo "$1" | tr '\n\t' ' ' | \
	sed -e 's/[\\|\#|\*]//g' \
		-e 's/\//\\\//g' \
		-e 's/\"/\\\"/g' )
	echo "$retVal"
	
}

if [ -f $TEMP ] ; then
    rm $TEMP
fi

for filename in ${MARKDOWN_FILES[@]}; do
 	title="$(echo $filename | awk '{gsub(".md$",""); gsub("-", " "); for(i=1;i<=NF;i++){ $i=toupper(substr($i,1,1)) substr($i,2) }; print;}')"
 	url="$(echo $filename | awk '{c=$0; sub(".md$","",c); printf "/%s.html" , c;}')"
 	echo "$title"
 	escapedTitle=$(jsonEscape "$title")
 	echo "$escapedTitle"
 	content="$(cat $filename)"
 	escapedContent=$(jsonEscape "$content")
 	printf '{"index":{"_id":"%s"}}\n{"title":"%s", "url":"%s", "content":"%s", "docAsUpsert":true}\n' "$filename" "$escapedTitle" "$url" "$escapedContent" >> "$TEMP"
done

echo 'The path $BONSAIURL is:'"$BONSAIURL"
echo '\nDelete index if it exists\n'
curl -XDELETE $BONSAIURL'/probono'

echo '\nCreate index\n'
curl -XPUT $BONSAIURL'/probono'

echo '\nAdd type to index\n'
curl -XPUT $BONSAIURL'/probono/_mapping/md' -H 'Content-Type: application/json' -d '{"properties": {"title": {"type": "string"}, "url": {"type": "string"}, "content": {"type": "string", "term_vector" : "with_positions_offsets"} } } '

echo '\nBulk upsert the markdown files\n'
curl -XPOST $BONSAIURL'/probono/md/_bulk?pretty' --data-binary @"$TEMP"

if [ -f $TEMP ] ; then
    rm $TEMP
fi