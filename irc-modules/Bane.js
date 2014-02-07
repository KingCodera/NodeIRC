module.exports = Bane;

function Bane(value) {    
    this.a = value;    
}

Bane.prototype.output = function() {
    console.log(this.a);
}