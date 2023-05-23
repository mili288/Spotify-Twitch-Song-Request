import express from 'express';
import SpotifyWebApi from 'spotify-web-api-node';
import tmi from 'tmi.js'; // Twitch chat library
import * as dotenv from 'dotenv';

const app = express();
const port = 3000;
dotenv.config()

// Configure Spotify API credentials
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: process.env.REDIRECT_URI,
});

// Twitch bot configuration
const twitchBotOptions = {
  identity: {
    username: 'SongRequestBot',
    password: process.env.PASSWORD,
  },
  channels: ['Mili28'],
};

// Create a Twitch client
const twitchClient = new tmi.client(twitchBotOptions);

// Connect to Twitch chat
twitchClient.connect();

// Listen to chat messages
twitchClient.on('message', (channel, userstate, message, self) => {
  // Check if the message matches the command
  if (message.startsWith('?song')) {
    const songName = message.slice(6).trim();

    // Search for the song on Spotify
    spotifyApi.searchTracks(songName)
      .then((data) => {
        // Extract the first track from the search results
        const track = data.body.tracks.items[0];

        if (!track) {
          twitchClient.say(channel, 'Song not found');
          return;
        }

        // Add the track to your playback queue
        spotifyApi.addToQueue(track.uri)
          .then(() => {
            twitchClient.say(channel, 'Song requested and added to queue');
          })
          .catch((error) => {
            console.error('Error adding track to playback queue', error);
            twitchClient.say(channel, 'An error occurred');
          });
      })
      .catch((error) => {
        console.error('Error searching tracks', error);
        twitchClient.say(channel, 'An error occurred');
      });

    } else if (message.startsWith('?skip')) {
      // Skip the current song
      spotifyApi.skipToNext()
        .then(() => {
          twitchClient.say(channel, 'Skipped the current song');
        })
        .catch((error) => {
          console.error('Error skipping song', error);
          twitchClient.say(channel, 'An error occurred');
        });
  }
});

// Authorization endpoint
app.get('/login', (req, res) => {
  const authorizeUrl = spotifyApi.createAuthorizeURL(['user-modify-playback-state'], 'STATE', true);
  res.send(authorizeUrl);
});

// Callback endpoint after user grants access
app.get('/callback', (req, res) => {
  const { code } = req.query;

  // Check if the code parameter exists
  if (!code) {
    console.error('No authorization code provided');
    res.send('Authentication failed!');
    return;
  }

  // Exchange authorization code for access token
  spotifyApi.authorizationCodeGrant(code)
    .then((data) => {
      const { access_token, refresh_token } = data.body;

      // Set the access token on the Spotify API instance
      spotifyApi.setAccessToken(access_token);
      spotifyApi.setRefreshToken(refresh_token);

      console.log('Authenticated with Spotify API');
      res.send('Authentication successful!');
    })
    .catch((error) => {
      console.error('Error authenticating with Spotify API', error);
      res.send('Authentication failed!');
    });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
