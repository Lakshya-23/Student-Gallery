import { useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { FaGraduationCap, FaImages, FaSearch, FaArrowLeft, FaTimes } from 'react-icons/fa';
import { IoMdImages } from 'react-icons/io';
import { ImSpinner8 } from 'react-icons/im';
import { MdOutlineWarning } from 'react-icons/md';
import axios from 'axios';

function App() {
  const [userImages, setUserImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const API_URL = import.meta.env.VITE_BACKEND_URL;

  const fetchUserImages = async ({ level }) => {
    setLoading(true);
    try {
      const baseUrl = API_URL.startsWith('http') ? API_URL : `https://${API_URL}`;
      const response = await axios.get(`${baseUrl}/api/images`, {
        params: { level }
      });

      const data = response.data;
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch images');
      }

      const imagesWithFullUrls = data.images.map(image => ({
        ...image,
        url: image.url.startsWith('/') ? `${baseUrl}${image.url}` : image.url
      }));

      setUserImages(imagesWithFullUrls);
      setSubmitted(true);

      if (imagesWithFullUrls.length > 0) {
        toast.success(`Found ${imagesWithFullUrls.length} images for ${level}`);
      } else {
        toast.error(`No images found for ${level}`);
      }
    } catch (err) {
      let errorMessage = 'Something went wrong';
      if (err.response) {
        errorMessage = err.response.data?.message || `Error: ${err.response.status}`;
      } else if (err.request) {
        errorMessage = 'No response from server. Is the server running?';
      } else {
        errorMessage = err.message;
      }
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const level = formData.get('level');
    fetchUserImages({ level });
  };

  const openImageModal = (image) => {
    setSelectedImage(image);
    setIsModalOpen(true);
  };

  const closeImageModal = () => {
    setIsModalOpen(false);
    setSelectedImage(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 md:p-8 flex flex-col">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '10px',
            background: '#333',
            color: '#fff',
          },
        }}
      />

      <header className="w-full max-w-5xl mx-auto mb-6 md:mb-10">
        <div className="flex items-center justify-center md:justify-start">
          <div className="flex items-center gap-2 bg-white py-2 px-4 rounded-full shadow-md">
            <IoMdImages className="h-5 w-5 text-blue-600" />
            <span className="font-semibold text-gray-800">Student Gallery</span>
          </div>
        </div>
      </header>

      <main className="flex-grow flex items-start justify-center w-full">
        <div className={`w-full ${submitted ? 'max-w-5xl' : 'max-w-xl'} mx-auto`}>
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
            <div className="p-5 sm:p-8">
              <div className="flex flex-col mb-8">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Student Image Gallery</h1>
                <p className="text-gray-500">Access your photos by selecting your academic level</p>
              </div>

              {!submitted ? (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <div className="flex items-center gap-2">
                        <FaGraduationCap className="h-4 w-4 text-gray-500" />
                        Level <span className="text-red-500">*</span>
                      </div>
                    </label>
                    <div className="relative">
                      <select
                        name="level"
                        className="w-full pl-10 pr-10 py-3 text-sm md:text-base border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors appearance-none bg-gray-50"
                        defaultValue="UG"
                        required
                      >
                        <option value="UG">Undergraduate (UG)</option>
                        <option value="PG">Postgraduate (PG)</option>
                        <option value="PHD">Doctorate (PhD)</option>
                      </select>

                      {/* Left icon */}
                      <div className="absolute left-0 inset-y-0 flex items-center pl-3 pointer-events-none">
                        <FaGraduationCap className="h-5 w-5 text-gray-400" />
                      </div>

                      {/* Dropdown arrow icon (right side) */}
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                        <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>

                  </div>

                  <button
                    type="submit"
                    className="w-full mt-8 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-150 text-sm md:text-base flex items-center justify-center"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <ImSpinner8 className="animate-spin mr-2 h-5 w-5" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <FaSearch className="mr-2 h-5 w-5" />
                        View My Images
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div>
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <ImSpinner8 className="animate-spin h-12 w-12 text-blue-600" />
                      <p className="mt-4 text-gray-500">Loading your images...</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                          <FaImages className="mr-2 h-5 w-5 text-blue-600" />
                          Your Images
                        </h2>
                        <button
                          onClick={() => setSubmitted(false)}
                          className="flex items-center text-sm text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <FaArrowLeft className="mr-1 h-4 w-4" />
                          Back to search
                        </button>
                      </div>

                      {userImages.length > 0 ? (
                        <div className="columns-1 sm:columns-2 md:columns-3 gap-4 space-y-4">
                          {userImages.map((image, index) => (
                            <div
                              key={index}
                              className="break-inside-avoid mb-4 bg-gray-50 overflow-hidden rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer"
                              onClick={() => openImageModal(image)}
                            >
                              <img
                                src={image.url}
                                alt={`Student image ${index + 1}`}
                                className="w-full h-auto object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  e.target.src = "https://placehold.co/400x225?text=Image+Unavailable";
                                  e.stopPropagation();
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md flex items-start">
                          <MdOutlineWarning className="h-6 w-6 text-yellow-500 mr-3 flex-shrink-0 mt-0.5" />
                          <div>
                            <h3 className="text-sm font-medium text-yellow-800">No images found</h3>
                            <p className="mt-1 text-sm text-yellow-700">
                              We couldn't find any images for the selected level.
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <footer className="text-center text-gray-500 text-xs mt-8">
            © {new Date().getFullYear()} Student Image Gallery. All rights reserved.
          </footer>
        </div>
      </main>

      {isModalOpen && selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center touch-none"
          onClick={closeImageModal}
        >
          <div
            className="relative max-w-full max-h-full p-2 sm:p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-3 right-3 z-10 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70 transition-colors"
              onClick={closeImageModal}
              aria-label="Close image"
            >
              <FaTimes className="w-5 h-5" />
            </button>

            <img
              src={selectedImage.url}
              alt="Full size image"
              className="max-h-[90vh] max-w-full object-contain rounded-lg"
              onError={(e) => {
                e.target.src = "https://placehold.co/800x600?text=Image+Unavailable";
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
