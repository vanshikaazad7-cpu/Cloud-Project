# AI Communication Coach

A Flask-based web application that uses **Azure Language Service** to analyze and coach communication through sentiment analysis and key phrase extraction. This cloud computing project integrates Azure AI services to provide real-time feedback on communication quality.

## 🌐 Website
Visit our application at: **[https://your-website-link.com](https://your-website-link.com)**
*(Update this link with your deployed application URL)*

## 📋 Project Details

### Description
The AI Communication Coach is an intelligent tool designed to help users improve their communication skills by:
- Analyzing sentiment in user-provided text
- Extracting key phrases and themes
- Providing confidence scoring on communication effectiveness
- Offering real-time feedback through an interactive web interface

### Tech Stack
- **Backend**: Flask 3.0+
- **Frontend**: HTML, CSS, JavaScript
- **Cloud Services**: Azure Language Service (Text Analytics)
- **Authentication**: Azure Key Credential
- **Configuration**: Python-dotenv for environment variables

### Features
- ✅ Real-time sentiment analysis
- ✅ Key phrase extraction
- ✅ Confidence scoring for communication effectiveness
- ✅ Interactive web-based user interface
- ✅ Azure cloud integration

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- Azure Language Service credentials (endpoint and API key)
- Flask and required dependencies

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/GithubProject.git
   cd GithubProject
   ```

2. **Create a virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up Azure credentials**
   Create a `.env` file in the project root:
   ```
   AZURE_LANGUAGE_ENDPOINT=your_azure_endpoint
   AZURE_LANGUAGE_KEY=your_azure_key
   ```

5. **Run the application**
   ```bash
   python app.py
   ```
   The app will be available at `http://localhost:5000`

## 📦 Dependencies
- `flask>=3.0.0` - Web framework
- `azure-ai-textanalytics>=5.3.0` - Azure Text Analytics SDK
- `azure-core>=1.30.0` - Azure core utilities
- `python-dotenv>=1.0.0` - Environment variable management

## 📁 Project Structure
```
├── app.py              # Flask backend application
├── requirements.txt    # Python dependencies
├── README.md          # This file
├── static/            # Static assets
│   ├── style.css      # Stylesheet
│   └── script.js      # Client-side JavaScript
└── templates/         # HTML templates
    └── index.html     # Main web interface
```

## 🔧 Configuration
The application uses environment variables for Azure credentials:
- `AZURE_LANGUAGE_ENDPOINT` - Your Azure Language Service endpoint
- `AZURE_LANGUAGE_KEY` - Your Azure Language Service API key

## 📝 License
This project is open source and available under the MIT License.

## 👥 Contributing
Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature suggestions.

---

**Last Updated**: May 2026