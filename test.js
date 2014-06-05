var Elasto = require('./');

Elasto.basePath = 'http://localhost:9200/boulevard-development';

Elasto.query('boutiques')
        .where('slug', 'cosi-homewares-in-n103hp')
        .returns('slug', 'name', 'address')
        .find().then(function (documents){
   console.log(documents);
});

Elasto.query('products')
.where({
    slug: 'cosi-homewares-in-n103hp',
    boutique_slug: 'fig-tree-reed-diffuser-from-orla-kiely'
})
.find().then(function (documents){

    console.log('documents', documents);
});
