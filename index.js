const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Player } = require('discord-player');
const { TOKEN } = require('./config.json');
const { DefaultExtractors } = require('@discord-player/extractor'); 

const client = new Client({
    intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates ]
});

const player = new Player(client, {
    ytdlOptions: { quality: 'highestaudio', highWaterMark: 1 << 25 }
});

player.extractors.loadMulti(DefaultExtractors).then(() => {
    console.log('Mesin pencari musik berhasil dimuat!');
});

client.once('clientReady', () => {
    console.log(`Bot berhasil online sebagai ${client.user.tag}!`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isAutocomplete()) return;
    if (interaction.commandName === 'play') {
        const query = interaction.options.getString('lagu', true);
        if (!query.trim()) {
            try { return await interaction.respond([]); } catch { return; }
        }
        try {
            const searchResult = await player.search(query);
            const results = searchResult.tracks.slice(0, 5).map(track => ({
                name: `${track.title} (${track.duration})`.slice(0, 100),
                value: track.url
            }));
            return await interaction.respond(results);
        } catch (error) {
            console.log('Autocomplete dilewati.');
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        const queue = player.nodes.get(interaction.guildId);
        if (!queue || !queue.isPlaying()) {
            return interaction.reply({ content: 'Tidak ada musik yang sedang diputar!', ephemeral: true });
        }

        if (interaction.customId === 'btn_pause') {
            const isPaused = queue.node.isPaused();
            queue.node.setPaused(!isPaused);
            return interaction.reply({ content: isPaused ? ' Musik dilanjutkan.' : ' Musik dijeda.', ephemeral: true });
        }
        if (interaction.customId === 'btn_skip') {
            queue.node.skip();
            return interaction.reply({ content: ' Lagu berhasil dilewati.', ephemeral: true });
        }
        if (interaction.customId === 'btn_stop') {
            queue.delete();
            return interaction.reply({ content: ' Bot dihentikan dan keluar.', ephemeral: true });
        }
    }

    
    if (!interaction.isChatInputCommand()) return;

    if (!interaction.member.voice.channel) {
        return interaction.reply({ content: 'Kamu harus masuk ke voice channel dulu!', ephemeral: true });
    }

    const command = interaction.commandName;

    if (command === 'play') {
        await interaction.deferReply();
        const query = interaction.options.getString('lagu');

        try {
            const { track } = await player.play(interaction.member.voice.channel, query, {
                nodeOptions: { metadata: interaction.channel }
            });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_pause').setLabel('Pause / Resume').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('btn_skip').setLabel('Skip').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('btn_stop').setLabel('Stop').setStyle(ButtonStyle.Danger)
            );

            const embed = new EmbedBuilder()
                .setTitle('🎶 Berhasil Menambahkan Lagu')
                .setDescription(`[${track.title}](${track.url})`)
                .setThumbnail(track.thumbnail)
                .addFields(
                    { name: 'Durasi', value: track.duration, inline: true },
                    { name: 'Oleh', value: track.author, inline: true }
                )
                .setColor('#00ffcc');

            return interaction.followUp({ embeds: [embed], components: [row] });
        } catch (e) {
            console.error(e);
            return interaction.followUp('Terjadi kesalahan saat mencoba memutar lagu ini.');
        }
    }

    const queue = player.nodes.get(interaction.guildId);
    if (!queue || !queue.isPlaying()) {
        if (command !== 'play') return interaction.reply({ content: 'Tidak ada musik yang sedang diputar di server ini.', ephemeral: true });
    }

    if (command === 'pause') { queue.node.setPaused(true); return interaction.reply(' Dijeda.'); }
    if (command === 'resume') { queue.node.setPaused(false); return interaction.reply(' Dilanjutkan.'); }
    if (command === 'skip') { queue.node.skip(); return interaction.reply(' Dilewati.'); }
    if (command === 'stop') { queue.delete(); return interaction.reply(' Dihentikan.'); }
    if (command === 'loop') {
        const mode = interaction.options.getInteger('mode');
        queue.setRepeatMode(mode);
        const modeNames = ['Mati ', 'Ulangi Lagu Ini ', 'Ulangi Antrean '];
        return interaction.reply(`Mode loop: **${modeNames[mode]}**`);
    }
});

client.on('error', error => console.error('Discord Client Error:', error));
process.on('unhandledRejection', error => console.error('Unhandled Promise Rejection:', error));
process.on('uncaughtException', error => console.error('Uncaught Exception:', error));

client.login(TOKEN);
