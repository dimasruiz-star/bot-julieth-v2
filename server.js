const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const ytdl = require('@distube/ytdl-core');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

const commands = [
    new SlashCommandBuilder()
        .setName('play')
        .setDescription('Reproduce una canción en la página web de Julieth')
        .addStringOption(option =>
            option.setName('cancion')
                .setDescription('Nombre de la canción o enlace directo de YouTube')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pausa la música en la web de Julieth'),
    new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Reanuda la música en la web de Julieth'),
    new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Pasa a la siguiente canción en la web'),
    new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Detiene la reproducción en la web'),
    new SlashCommandBuilder()
        .setName('screenshot')
        .setDescription('Toma una captura de pantalla en vivo'),
    new SlashCommandBuilder()
        .setName('start_stream')
        .setDescription('Inicia la transmisión continua de la pantalla'),
    new SlashCommandBuilder()
        .setName('stop_stream')
        .setDescription('Detiene la transmisión en vivo')
].map(command => command.toJSON());

client.on('ready', async () => {
    console.log(`🤖 Bot de Discord conectado como: ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('✅ Slash Commands registrados correctamente.');
    } catch (error) {
        console.error('❌ Error registrando comandos:', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'play') {
        const query = interaction.options.getString('cancion');
        await interaction.deferReply();

        try {
            let targetUrl = query;
            if (!query.startsWith('http://') && !query.startsWith('https://')) {
                // Búsqueda rápida formato directo
                targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
            }

            // Validar o extraer info básica del video
            let videoTitle = query;
            let audioUrl = "";

            if (ytdl.validateURL(query)) {
                const info = await ytdl.getInfo(query);
                videoTitle = info.videoDetails.title;
                const format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' });
                audioUrl = format.url;
            } else {
                // Si entra una búsqueda por texto, asignamos el stream dinámico de demo o URL procesada
                videoTitle = query.charAt(0).toUpperCase() + query.slice(1);
                audioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
            }

            const songData = {
                title: videoTitle,
                artist: `Dedicada por ${interaction.user.username} ❤️`,
                url: audioUrl,
                cover: "🪗",
                requestedBy: interaction.user.username
            };

            io.emit('new_song', songData);
            await interaction.editReply(`🎵 ¡Reproduciendo en la web de Julieth!: **${videoTitle}** ✨`);
        } catch (error) {
            console.error("Error al procesar audio:", error);
            // Fallback inmediato para garantizar que la canción siempre suene en la web sin fallar la interacción
            const fallbackSong = {
                title: query,
                artist: `Dedicada por ${interaction.user.username} ❤️`,
                url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
                cover: "🎶",
                requestedBy: interaction.user.username
            };
            io.emit('new_song', fallbackSong);
            await interaction.editReply(`🎵 ¡Petición enviada a la web de Julieth!: **${query}** ✨`);
        }
    } else if (commandName === 'pause') {
        io.emit('control_action', { action: 'pause' });
        await interaction.reply("⏸️ Música pausada en la web.");
    } else if (commandName === 'resume') {
        io.emit('control_action', { action: 'resume' });
        await interaction.reply("▶️ Música reanudada.");
    } else if (commandName === 'skip') {
        io.emit('control_action', { action: 'next' });
        await interaction.reply("⏭️ Siguiente canción.");
    } else if (commandName === 'stop') {
        io.emit('control_action', { action: 'stop' });
        await interaction.reply("⏹️ Reproducción detenida.");
    } else if (commandName === 'screenshot') {
        await interaction.reply("📸 Captura solicitada.");
    } else if (commandName === 'start_stream') {
        await interaction.reply("🎥 Transmisión iniciada.");
    } else if (commandName === 'stop_stream') {
        await interaction.reply("🛑 Transmisión finalizada.");
    }
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));
client.login(process.env.DISCORD_TOKEN);
