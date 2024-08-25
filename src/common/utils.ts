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



export const fetchDetailsFromOmdb = async(title: string, omdbApiKey): Promise<any> => {
    try {
      const response = await axios.get(
        `http://www.omdbapi.com/?t=${title}&apikey=${this.configService.get<string>('OMDB')}`,
      );
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch show details');
    }
  }