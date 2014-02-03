var strings = [
	"妖精 [ようせい] /(n,adj-no) fairy/sprite/elf/(P)/"
];

formatWord = function(word) {
	word = word.replace(/\/\(P\)/g, " (P)");	
	var array = word.split(/(?=[^A-z])\/(?=[^A-z]|$)/);	
	var definitions = [];
	definitions.push(array[0]);
	array.splice(0,1);
	
	for (var i in array) {		
		var common = false;
		switch(true) {
			case (array[i].indexOf("(P)") > -1): common = true;
			default: 
				var def = array[i];
				if (def == "") break;
				def = def.replace(/\([A-z0-9-,]*\)/g, '').trim();
				def = def.replace(/\//g, "," );
				if (common) {
					var temparray = def.split(",");
					for (var j in temparray) {
						temparray[j] = "C" + temparray[j];
					}
					def = temparray.join(", ");
				}				
				var index = parseInt(i) + 1;
				definitions.push("[#" + index + "] " + def);
				break;
		}
	}
	
	return definitions;
}

console.log(formatWord(strings[0]));