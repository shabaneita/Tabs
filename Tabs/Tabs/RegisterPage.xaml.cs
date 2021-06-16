using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using Xamarin.Forms;
using Xamarin.Forms.Xaml;

namespace Tabs
{
    [XamlCompilation(XamlCompilationOptions.Compile)]
    public partial class RegisterPage : ContentPage
    {
        public RegisterPage()
        {
            InitializeComponent();
        }

        private void myregister(object sender, EventArgs e)
        {
            Navigation.PushAsync(new Profile());
        }

        private void alreadyregister(object sender, EventArgs e)
        {
            Navigation.PushAsync(new LogIn());
        }
    }
}