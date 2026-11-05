const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const play = require('play-dl');

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

// Registrar TODOS tus comandos anteriores + los comandos de música nuevos
const commands = [
    // Comandos de Música para la Web
    new SlashCommandBuilder()
        .setName('play')
        .setDescription('Reproduce una canción en la página web de Julieth')
        .addStringOption(option =>
            option.setName('cancion')
                .setDescription('Nombre o enlace de la canción')
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

    // Tus comandos existentes
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

// Registrar los Slash Commands al conectar en Discord
client.on('ready', async () => {
    console.log(`🤖 Bot de Discord conectado como: ${client.user.tag}`);
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('🔄 Actualizando Slash Commands (/)....');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('✅ ¡Todos los Slash Commands (música y sistema) han sido registrados con éxito!');
    } catch (error) {
        console.error('❌ Error al registrar Slash Commands:', error);
    }
});

// Manejador único de interacciones
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // --- COMANDOS DE MÚSICA ---
    if (commandName === 'play') {
        const query = interaction.options.getString('cancion');
        await interaction.deferReply();

        try {
            const ytResults = await play.search(query, { limit: 1 });
            if (!ytResults || ytResults.length === 0) {
                return interaction.editReply(`❌ No encontré ninguna canción llamada: **${query}**`);
            }

            const song = ytResults[0];
            const streamInfo = await play.stream(song.url);

            const songData = {
                title: song.title,
                artist: song.channel ? song.channel.name : "Artista",
                url: streamInfo.url,
                cover: song.thumbnails[0]?.url || "🪗",
                requestedBy: interaction.user.username
            };

            io.emit('new_song', songData);
            await interaction.editReply(`🎵 ¡Reproduciendo en la web de Julieth!: **${song.title}** ✨`);
        } catch (error) {
            console.error(error);
            await interaction.editReply("⚠️ Ocurrió un error al procesar el audio.");
        }
    } else if (commandName === 'pause') {
        io.emit('control_action', { action: 'pause' });
        await interaction.reply("⏸️ Música pausada en la web de Julieth.");
    } else if (commandName === 'resume') {
        io.emit('control_action', { action: 'resume' });
        await interaction.reply("▶️ Música reanudada en la web.");
    } else if (commandName === 'skip') {
        io.emit('control_action', { action: 'next' });
        await interaction.reply("⏭️ Pasando a la siguiente canción.");
    } else if (commandName === 'stop') {
        io.emit('control_action', { action: 'stop' });
        await interaction.reply("⏹️ Reproducción detenida.");
    }
    
    // --- TUS COMANDOS EXISTENTES ---
    else if (commandName === 'screenshot') {
        await interaction.reply("📸 Comando de captura recibido.");
    } else if (commandName === 'start_stream') {
        await interaction.reply("🎥 Iniciando transmisión continua.");
    } else if (commandName === 'stop_stream') {
        await interaction.reply("🛑 Transmisión en vivo detenida.");
    }
});

io.on('connection', (socket) => {
    console.log('🌐 Conexión WebSockets establecida con la web de Julieth');
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor activo en puerto ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);
