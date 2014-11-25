// USER
var user = {};

function getUser(){
    return user;
}

function resetUser(){
    user = {};
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
    getUser: getUser,
    resetUser: resetUser,
    getResponse: getResponse,
    getTokens: getTokens
};