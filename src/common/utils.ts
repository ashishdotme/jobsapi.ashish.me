import axios from 'axios';

export const sendEvent = async (
  type: string,
  message: string,
): Promise<void> => {
  await axios.post('https://api.ashish.me/events', {
    type,
    message,
  });
};

export const fetchDetailsFromOmdb = async (
  title: string,
  omdbApiKey,
): Promise<any> => {
  try {
    const response = await axios.get(
      `http://www.omdbapi.com/?t=${title}&apikey=${omdbApiKey}`,
    );
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch details from OMDB - ${error}`);
  }
};

export const fetchDetailsFromImdb = async (title: string): Promise<any> => {
  try {
    const response = await axios.get(
      `https://imdb.ashish.me/search?query=${title.replace(' ', '%20')}`,
    );

    if (!response.data) {
      throw new Error(`Failed to fetch details from IMDB - Not found`);
    }

    const imdbId = response.data.results[0].id;
    const finalResponse = await axios.get(
      `https://imdb.ashish.me/title/${imdbId.trim()}`,
    );
    return finalResponse.data;
  } catch (error) {
    throw new Error(`Failed to fetch details from IMDB - ${error}`);
  }
};
