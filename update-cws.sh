# Store our credentials in our home directory with a file called .
my_creds=~/.`basename $0`

appid=$1
zipfile=$2

# https://developers.google.com/identity/protocols/OAuth2InstalledApp#creatingcred
client_id='311118430818-9btaroouc454mgp3pe4e5d60t5q0ok61.apps.googleusercontent.com'
client_secret='wYKfNtR_3lc3f1n74Nv69lrk'

if [ -s $my_creds ]; then
  # if we already have a token stored, use it
  . $my_creds
  time_now=`date +%s`
else
  scope='https://www.googleapis.com/auth/chromewebstore'
  # Form the request URL
  # https://developers.google.com/identity/protocols/OAuth2InstalledApp#step-2-send-a-request-to-googles-oauth-20-server
  auth_url="https://accounts.google.com/o/oauth2/v2/auth?client_id=$client_id&scope=$scope&response_type=code&redirect_uri=urn:ietf:wg:oauth:2.0:oob"

  echo "Please go to:"
  echo
  echo "$auth_url"
  echo
  echo "after accepting, enter the code you are given:"
  read auth_code

  # exchange authorization code for access and refresh tokens
  # https://developers.google.com/identity/protocols/OAuth2InstalledApp#exchange-authorization-code
  auth_result=$(curl -s "https://www.googleapis.com/oauth2/v4/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d code=$auth_code \
    -d client_id=$client_id \
    -d client_secret=$client_secret \
    -d redirect_uri=urn:ietf:wg:oauth:2.0:oob \
    -d grant_type=authorization_code)
  access_token=$(echo -e "$auth_result" | \
                 grep -Po '"access_token" *: *.*?[^\\]",' | \
                 awk -F'"' '{ print $4 }')
  refresh_token=$(echo -e "$auth_result" | \
                  grep -Po '"refresh_token" *: *.*?[^\\]",*' | \
                  awk -F'"' '{ print $4 }')
  expires_in=$(echo -e "$auth_result" | \
               grep -Po '"expires_in" *: *.*' | \
               awk -F' ' '{ print $3 }' | awk -F',' '{ print $1}')
  time_now=`date +%s`
  expires_at=$((time_now + expires_in - 60))
  echo -e "access_token=$access_token\nrefresh_token=$refresh_token\nexpires_at=$expires_at" > $my_creds
fi

# if our access token is expired, use the refresh token to get a new one
# https://developers.google.com/identity/protocols/OAuth2InstalledApp#offline
if [ $time_now -gt $expires_at ]; then
  refresh_result=$(curl -s "https://www.googleapis.com/oauth2/v4/token" \
   -H "Content-Type: application/x-www-form-urlencoded" \
   -d refresh_token=$refresh_token \
   -d client_id=$client_id \
   -d client_secret=$client_secret \
   -d grant_type=refresh_token)
  access_token=$(echo -e "$refresh_result" | \
                 grep -Po '"access_token" *: *.*?[^\\]",' | \
                 awk -F'"' '{ print $4 }')
  expires_in=$(echo -e "$refresh_result" | \
               grep -Po '"expires_in" *: *.*' | \
               awk -F' ' '{ print $3 }' | awk -F',' '{ print $1 }')
  time_now=`date +%s`
  expires_at=$(($time_now + $expires_in - 60))
  echo -e "access_token=$access_token\nrefresh_token=$refresh_token\nexpires_at=$expires_at" > $my_creds
fi

# call the CWS API
# https://developer.chrome.com/webstore/using_webstore_api#uploadexisitng
  api_data=$(curl -vvvv -X PUT  https://www.googleapis.com/upload/chromewebstore/v1.1/items/$appid \
    -H "Authorization: Bearer $access_token" \
    -H "x-goog-api-version: 2" \
    -H "Content-Type: application/json" \
    -T $zipfile)
  echo -e "$api_data"
