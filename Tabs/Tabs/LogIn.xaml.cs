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
    public partial class LogIn : ContentPage
    {
        public LogIn()
        {
            InitializeComponent();
        }

        private void mylogin(object sender, EventArgs e)
        {
            Navigation.PushAsync(new Profile());
        }

        private void mycancle(object sender, EventArgs e)
        {
            Navigation.PopAsync();
        }
    }
}