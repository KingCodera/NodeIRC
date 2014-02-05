'use strict';

var client = require('../index').createClient(
    'Precure Module',
    'precure',
    {time: 4000, hashKey: 'asdf', persistent: true}
);

function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

var chars = ['Regina', 'Ira', 'Bale', 'Marmo', 'Riva', 'Gula'];
var trait = ['greed', 'wrath', 'sloth', 'envy', 'pride', 'gluttony'];

var endings = [
    ['%s turned into huge crab and shouts, "I don\'t wanna wait in lines!"', [
        'After running around rampart for a long time, %s goes very sad that nobody cared.',
        [
            'Cure Heart feels bad for poor %s and gives them her Sweet Heart, purifying them of their evil-doing.',
            [
                'Afterwards, Cure Heart jumps to save Cure Sword from another Ego, leaving %s confused.',
                'Afterwards, Cure Heart gives them a sturn teaching on how he shouldn\'t give in to his selfish feelings.',
                ['Cure Heart embraces %s in a lovely embrace and whispers softly in their ear: "You mustn\'t give in to your desires."',
                 '%s feels sheepisly but Cure Heart only smiles warmly. She takes their hand and leads them down the road. With a wink she says: "Come to my room and tell me all about your desires." <3'
                ]
            ]
        ],
        'In a frenzy, %s uses his huge claws to cut, not only the line. but also the clothes of any girl in it. What an ecchi Ego... but also a lovely sight for the guys in the area! :D'
    ]],
    ['%s turned into a huge lamp post and shouts "I control the lights!"', [
        'After stopping the time everywhere, %s suddenly grows very lonely with nobody to interact with. They become alone in the world. :(',
        [
            'In a brave move, Rikka manages to unfreeze time and %s gets hit with a full blast of My Sweet Heart.',
            [
                'Overjoyed for having saved both of them, Rikka runs to Mana and they leave together. Poor %s was simply left behind without a moments thought. :(',
                'Rikka notices that it was %s that turned into an Ego. Very dissapointed with them giving into their desires, she walks up to them and says: "How can I trust you when you simply give in like that?! I hate you." She then leaves them behind.',
                'Rikka runs up to %s. Helping them up, she carries them on her shoulder. "I\'m so sorry you got hurt. Let me take you home to me and I\'ll take care of you in any way you need." <3'
            ]
        ],
        'In a sneaky move, %s stops time and starts peeking under girl\'s skirt at their panties and going to girl\'s changing room. What an ecchi Ego... ;)'
    ]],
    ['%s turned into a giant goat and shouts "Give me all your meee-ail!"', [
        ['They attack all the mailboxes in the area, eating all the letters in it. Suddenly, %s grows stomach ache from eating all the mail.','In the following days, %s spent all of his time wallowing in bed from all the pain.'],
        [
            'Attacking a local postbox, they suddenly hear a call: "Not so fast". Turning behind they spot Cure Heart looking ready for fight. "No, the mail is mine!" they retort and attack Cure Heart.',
            [
                'Rikka spots the fight, pulls up a chair and grabs her popcorn. "This is gonna be good," she says as she watches poor %s getting his ass kicked by Cure Heart.',
                '"How dare you attack my best friend," %s hears as Rikka comes from around the corner. In full kick-ass mode, Rikka transforms into Cure Diamond and full blasts them with the force of Twinkle Diamond. Leaving behind was only their frozen \'corpse\'.',
                ['Walking around the corner, Rikka sees Cure Heart fighting them. Seeing her friend in a need for help, Rikka transforms into Cure Diamond and with teamwork they purify %s.',
                 'After purifying them, the girls run up to them. With a smile they ask "Are you okay?" as they lie dazed from the after effect of the purification. Overflowing with love, they help %s up and start guiding them. To where? That\'s a good question ;)']
            ]
        ],
        'With greedy eyes, %s spots a girl walking nearby. They jump onto her and eat off all her clothes, leaving her completely in the nude~ ;)'
    ]]
];

function displayPath(client, message, path) {
    if (typeof(path) === 'string') {
        return client.sendText(message.to, path.replace('%s', message.nick));
    }
    var go = 0;
    /*if (path.length === 3) {
        var num = random(0, 10);
        if (num < 6) go = 0;
        else if (num < 10) go = 1;
        else go = 2;
    }
    else */
    if (path.length === 2 && typeof(path[0]) === 'string') {
        displayPath(client, message, path[0]);
        displayPath(client, message, path[1]);
        return;
    }
    else {
        go = random(0, path.length - 1);
    }
    displayPath(client, message, path[go]);
}

var handler = function(message) {
    if (this.allow === false) {
        return;
    }
    this.allow = false;

    setTimeout(function() {
        this.allow = true;
    }.bind(this), 60000);

    var num = random(0, chars.length - 1);
    client.inQueue = 0;
    this.sendText(message.to, [
        message.nick,
        'was turned into an Ego by',
        chars[num],
        'for his',
        trait[num] + '.'
    ].join(' '));
    client.inQueue = 1;
    displayPath(this, message, endings);
};

client.on('!ego', handler);

client.connect(20000);
