using System;
using Xamarin.Forms;
using Xamarin.Forms.Xaml;

namespace Tabs
{
    public partial class App : Application
    {
        public App()
        {
            InitializeComponent();

          //   MainPage = new MainPage();
           MainPage = new NavigationPage(new Tabs.RegisterPage());
        }

        protected override void OnStart()
        {
        }

        protected override void OnSleep()
        {
        }

        protected override void OnResume()
        {
        }
    }
}
