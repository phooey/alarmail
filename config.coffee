exports.config =
    paths:
        public: 'public'
    files:
        javascripts:
            joinTo:
                'js/vendor.js': /^bower_components/
                'js/app.js': /^js/
            order:
                before: [
                    'bower_components/jquery/dist/jquery.js',
                    'bower_components/angular/angular.js',
                    'bower_components/bootstrap/dist/bootstrap.js',
                    'bower_components/angular-bootstrap-switch/angular-bootstrap-switch.js',
                    'bower_components/bootstrap-switch/dist/bootstrap-switch.js'
                ]
        stylesheets:
            joinTo:
                'css/vendor.css': /^bower_components/
                'css/app.css': /^css/
            order:
                before: [
                        'bower_components/bootstrap/dist/css/bootstrap.css',
                        'bower_components/bootstrap-switch/dist/css/bootstrap3/bootstrap-switch.css'
                    ]
    paths:
        watched: ['css', 'js', 'static']
    conventions:
        assets: /(static|fonts)[\\/]/
    modules:
        wrapper: false
        definition: false
    plugins:
        afterBrunch: [
            [
                'mkdir -p public/fonts',
                'cp bower_components/bootstrap/fonts/* public/fonts',
                'htmlhint static/*.html'
            ].join(' && ')
        ]
        jshint:
            options:
                curly: true
            pattern: /^js[\\\/].*\.js$/

