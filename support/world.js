// USER
var user = {};

function getUser(){
    return user;
}

// RESPONSE
var response = {};

function getResponse(){
    return response;
}

// TOKENS
var tokens = {}

function getTokens(){
    return tokens;
}


module.exports = {
    getUser : getUser,
    getResponse : getResponse,
    getTokens : getTokens
}